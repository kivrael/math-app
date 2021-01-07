import React, { useState, useEffect, useRef } from 'react';
import * as math from 'mathjs';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import OperationList from './OperationList'


export default function ManipulateExpression(props) {

    const { submitInput } = props
    const [expressionTree, setExpressionTree] = useState(math.parse(submitInput))
    const expressionHistory = useRef([])
    let expressionTexString = expressionTree.toTex({parenthesis: 'auto', implicit: 'show'}).toString()
    let nodes, availOperations

    useEffect(() => {
        setExpressionTree(math.parse(submitInput))
        expressionHistory.current = []
    }, [submitInput])

    function getAvailOperations(expression) {
        let rank=0, commuteGroup = []
        nodes = []; availOperations = [];
        let sign, fn, dir, target, amount, fromSign, toSign, opName, conj;
        expression.traverse(function (node) { node.rank = rank; nodes.push(node); rank++;  })
        //console.log(nodes)
        expression.traverse(function (node, path, parent) {
            switch (node.op) {
            case '+':
            case '-':
                if ( node.fn === 'unaryMinus' && ( node.rank === 0 || parent.op === '*' ) ) { break; }
                if (node.rank === 0 || (parent.op!=='+' && parent.op!=='-') ) { commuteGroup = []; }
                node.args.forEach((child,index) => {
                    if ( child.op !== '+' && child.op !== '-' ) {
                            if ( index === 0 && node.fn === 'subtract' ) { sign = '+' }
                            else { sign = node.op }
                            if ( index === 0 && node.fn !== 'unaryMinus' ) { fn = 'add' }
                            else { fn = node.fn }
                        commuteGroup.push({op:sign, sign:sign, rank:child.rank, value:child.toString({parenthesis: 'auto'}), fn:fn})
                        }
                    })
                break;
            case '*':
                if (node.rank === 0 || parent.op !== '*' ) { commuteGroup = []; }
                node.args.forEach((child) => {
                    if ( child.op !== '*' ) { 
                        commuteGroup.push( { op:node.op, rank:child.rank, value:child.toString({parenthesis: 'auto'}) } )
                    } })
                break;
            default:
                if ( commuteGroup !== [] ) {
                    commuteGroup.sort(function(a,b) { return a.rank - b.rank })
                    //console.log('commuteGroup',commuteGroup)
                    commuteGroup.forEach((from, fromIndex) =>  {
                        commuteGroup.forEach((to,toIndex) => {
                            if (toIndex !== fromIndex) {
                                amount = toIndex-fromIndex
                                dir = amount > 0 ? 'right' : 'left'
                                target = math.abs(amount) === 1 ? ' to the '+dir : ' to the '+dir+' '+math.abs(amount)+' times'
                                fromSign = from.op === '-' ? '-' : ''
                                availOperations.push({key:'move '+from.rank+target, name:'move '+fromSign+from.value+target, type:'mv', index:fromIndex, amount:amount, group:commuteGroup})
                                toSign = to.op === '-' ? '-' : ''
                                conj = to.op === '*' ? 'by' : 'to'
                                if ( nodes[to.rank].isConstantNode && nodes[from.rank].isConstantNode ) {
                                    opName = from.op === '+' ? 'add' : from.op === '-' ? 'subtract' : 'multiply'
                                    availOperations.push({key:opName+from.rank+conj+to.rank, name:opName+' '+from.value+' '+conj+' '+toSign+to.value, type:from.op, fromValue:fromSign+from.value, toValue:toSign+to.value, from:from.rank, to:to.rank, fromIndex:fromIndex, toIndex:toIndex, group:commuteGroup}) }
                                else if ( from.op === '*' && ( nodes[to.rank].fn === 'unaryMinus' || nodes[from.rank].fn === 'unaryMinus' ) ) {
                                    availOperations.push({key:'*neg'+from.rank+conj+to.rank, name:'product with negative : '+from.value+' '+conj+' '+toSign+to.value, type:'*neg', fromValue:fromSign+from.value, toValue:toSign+to.value, from:from.rank, to:to.rank, fromIndex:fromIndex, toIndex:toIndex, group:commuteGroup}) }
                            }
                        })
                    })
                    commuteGroup = [];
                }
                break;
            }
        })
    }

    function move(expression, group, leftIndex, rightIndex) {
        let newExpr
        let leftRank = group[leftIndex].rank
        let rightRank = group[rightIndex].rank
        newExpr = expression.transform( function (node, path) {
            switch (group[leftIndex].op) {
                case '+':
                case '-':
                    if ( node.isOperatorNode && node.fn === 'unaryMinus' ) {
                        if ( node.args[0].rank === leftRank ) {
                            return group[rightIndex].sign === '-' ? new math.OperatorNode('-','unaryMinus',[nodes[group[rightIndex].rank]]) : nodes[group[rightIndex].rank] }
                        else { return node } }
                    else if ( node.isOperatorNode && node.args[1].rank === rightRank ) {
                        node.op = group[leftIndex].sign
                        if ( group[leftIndex].fn === 'unaryMinus' ) { node.fn = 'subtract' }
                        else { node.fn = group[leftIndex].fn }
                        return node
                        }
                    else if ( node.isOperatorNode && node.args[1].rank === leftRank ) { 
                        node.op = group[rightIndex].sign; node.fn = group[rightIndex].fn; return node }
                    else if ( node.rank === leftRank ) {
                        if ( path === 'args[0]' && group[rightIndex].sign === '-' ) {
                            return new math.OperatorNode('-','unaryMinus',[nodes[group[rightIndex].rank]]) }
                        else { return nodes[rightRank] } }
                    else if ( node.rank === rightRank ) { return nodes[leftRank] }
                    else {return node}
                case '*':
                    if ( node.rank === leftRank ) { return nodes[rightRank] }
                    else if ( node.rank === rightRank ) { return nodes[leftRank] }
                    else { return node }
                default:
            }
        })
       return newExpr
    }  

    function executeOperation(opRank) {

        expressionHistory.current.push(expressionTree.toString())

        let op = availOperations[opRank]
        let group = op.group
        let newExpression = expressionTree,
        fromRank = op.from,
        toRank = op.to,
        fromParent, toParent;
        expressionTree.traverse(function (node, path, parent) {
            if (node.rank === fromRank) { fromParent = parent.rank }
            else if ( node.rank === toRank ) { toParent = parent.rank }
        })
        switch (op.type) {
            case 'mv':
                const dir = op.amount > 0 ? +1 : -1
                const startIndex = op.index;
                const endIndex = startIndex + op.amount
                let leftIndex, rightIndex
                for (let i = startIndex; i !== endIndex ; i += dir) {
                    leftIndex = math.min(i, i + dir)
                    rightIndex = math.max(i, i + dir)
                    group = availOperations[opRank].group
                    newExpression = move(newExpression, group, leftIndex, rightIndex)
                    getAvailOperations(newExpression)
                }
                break;
            case '+':
            case '-':
                let sum, sumNode, newNode, newParent
                sum = parseInt(op.fromValue)+parseInt(op.toValue)
                sumNode = new math.ConstantNode(math.abs(sum))
                if ( math.max(op.fromIndex,op.toIndex) === 1 ) {
                    newExpression = expressionTree.transform(function (node) {
                        newParent = fromParent === toParent - 1 ? fromParent : toParent
                        if ( node.rank === newParent ) { 
                            if ( sum > 0 ) { return sumNode }
                            else { return new math.OperatorNode('-','unaryMinus',[sumNode]) } }
                        else { return node }
                    }) }
                else {
                    if ( op.toIndex === 0 ) {
                        newExpression = expressionTree.transform(function (node) {
                            newNode = group[0].fn === 'unaryMinus' ? toParent : toRank
                            if ( node.rank === newNode ) {
                                if ( sum > 0 ) { return sumNode }
                                else { return new math.OperatorNode('-','unaryMinus',[sumNode]) } }
                            else { return node }  
                            }) }
                    else {
                        newExpression = expressionTree.transform(function (node) {
                            if ( node.rank === toParent ) { 
                                node.op = sum > 0 ? '+' : '-'
                                node.fn = sum > 0 ? 'add' : 'subtract'
                                return node }
                            else if ( node.rank === toRank ) { return sumNode }
                            else { return node }
                        }) }
                    let rank = 0; newExpression.traverse(function (node) { node.rank=rank; rank++ })
                    if ( op.fromIndex === 0 ) {
                        newExpression = newExpression.transform(function (node) {
                            newNode = group[0].fn === 'unaryMinus' ? fromParent - 1 : fromParent
                            if ( node.rank === newNode ) {
                                return node.op === '+' ? node.args[1] : new math.OperatorNode('-','unaryMinus',[node.args[1]]) }
                            else { return node } }) }
                    else {
                        newExpression = newExpression.transform(function (node) {
                            if ( node.rank === fromParent ) { return node.args[0].rank === fromRank ? node.args[1] : node.args[0] }
                            else { return node }
                        }) }
                }

                break;
            case '*': // only for the two first elements of the product
                let product, productNode
                product = parseInt(op.fromValue)*parseInt(op.toValue)
                productNode = new math.ConstantNode(math.abs(product))
                if ( math.max(op.toIndex,op.fromIndex) === 1 ) {
                    newExpression = expressionTree.transform(function (node) {
                        if ( node.rank === toParent ) { return productNode }
                        else { return node }
                    })
                }
                break;
            case '*neg': // only for the two first elements of the product
                if ( math.max(op.toIndex,op.fromIndex) === 1 ) {
                    if ( nodes[op.to].fn === 'unaryMinus' && nodes[op.from].fn === 'unaryMinus' ) {
                        newExpression = expressionTree.transform(function (node) {
                            if ( [toRank,fromRank].includes(node.rank) ) { return node.args[0] }
                            else { return node }
                        }) }
                    else {
                        newExpression = expressionTree.transform(function (node) {
                            if ( [toRank,fromRank].includes(node.rank) && node.fn === 'unaryMinus' ) { return node.args[0] }
                            else { return node }
                        })
                        let rank = 0; newExpression.traverse(function (node) { node.rank=rank; rank++ })
                        newExpression = newExpression.transform(function (node) {
                            if ( node.rank === toParent ) { return new math.OperatorNode('-','unaryMinus',[new math.ParenthesisNode(node)]) }
                            else { return node }
                        })
                    }
                }                
                break;
            default:
        }
        setExpressionTree(newExpression)
    }

    function handleUndo() {
        if (expressionHistory.current.length > 0) {
            setExpressionTree(math.parse(expressionHistory.current.pop()))
        }
    }

    function handleReset(){
        if (expressionHistory.current.length > 0) {
            expressionHistory.current = [expressionHistory.current[0]]
            setExpressionTree(math.parse(expressionHistory.current.pop()))
        }
    }
    

    function removeParenthesis() {
        let unnecessaryParenthesis = false
        let newExpression = expressionTree.transform(function (node) {
            if ( node.isParenthesisNode && ( node.content.isConstantNode || node.content.fn === 'unaryMinus' ) ) { unnecessaryParenthesis = true; return node.content }
            else { return node }
        })
        if (unnecessaryParenthesis) { setExpressionTree(newExpression) }
    }

    removeParenthesis()
    getAvailOperations(expressionTree)
    //console.log(availOperations)

    return (
        <>
            <BlockMath>{"\\color{white} "+expressionTexString}</BlockMath>
            <OperationList availOperations={availOperations} executeOperation={executeOperation}/>
            <button onClick={handleUndo}>undo</button>
            <button onClick={handleReset}>reset</button>
        </>
    )
}
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
        let rank=0, commuteGroup = [], nodes = [], availOperations = [];
        let sign, fn, dir, target, amount, fromSign, toSign;
        expression.traverse(function (node) { node.rank = rank; nodes.push(node); rank++;  })
        //console.log(nodes)
        expressionTree.traverse(function (node, path, parent) {
            if ( ['+', '-'].includes(node.op) ) {
                if (node.rank === 0 || (parent.op!=='+' && parent.op!=='-') ) { commuteGroup = []; } //case where nodes[0] is not plus or minus?
                node.args.forEach((child,index) => {
                    if ( child.op !== '+' && child.op !== '-' ) {
                            if ( index === 0 && node.fn === 'subtract' ) { sign = '+'}
                            else { sign = node.op }
                            if ( index === 0 && node.fn !== 'unaryMinus' ) { fn = 'add' }
                            else { fn = node.fn }
                        commuteGroup.push({sign:sign, rank:child.rank, value:child.toString({parenthesis: 'auto'}), fn:fn})
                        }
                    })
            }
            else if ( commuteGroup !== [] ) {
                commuteGroup.sort(function(a,b) { return a.rank - b.rank })
                //console.log('commuteGroup',commuteGroup)
                commuteGroup.forEach((from, fromIndex) =>  {
                    commuteGroup.forEach((to,toIndex) => {
                        if (toIndex !== fromIndex) {
                            fromSign = from.sign === '+' ? '' : '-'
                            amount = toIndex-fromIndex
                            dir = amount > 0 ? 'right' : 'left'
                            target = math.abs(amount) === 1 ? ' to the '+dir : ' to the '+dir+' '+math.abs(amount)+' times'
                            //availOperations.push({key:'move '+from.rank+target, name:'move '+fromSign+from.value+target, type:'mv', index:fromIndex, amount:amount, group:commuteGroup})
                            if ( math.abs( toIndex - fromIndex ) === 1 ) { availOperations.push({key:'move '+from.rank+target, name:'move '+fromSign+from.value+target, type:'mv', index:fromIndex, amount:amount, group:commuteGroup}) }
                            if (nodes[to.rank].isConstantNode && nodes[from.rank].isConstantNode) {
                                 toSign = to.sign === '+' ? '' : '-'
                                if (fromSign === '') { availOperations.push({key:'add'+from.rank+'to'+to.rank, name:'add '+from.value+' to '+toSign+to.value, type:'+', fromValue:fromSign+from.value, toValue:toSign+to.value, from:from.rank, to:to.rank, fromIndex:fromIndex, toIndex:toIndex, group:commuteGroup}) }
                                else { availOperations.push({key:'subtract'+from.rank+'to'+to.rank, name: 'substract '+from.value+' to '+toSign+to.value, type:'-', fromValue:fromSign+from.value, toValue:toSign+to.value, from:from.rank, to:to.rank, fromIndex:fromIndex, toIndex:toIndex, group:commuteGroup}) }
                            }
                        }
                    })
                })
                commuteGroup = [];
            }
        })
    }

    function move(expression, group, leftIndex, rightIndex) {
        let newExpr
        let leftRank = group[leftIndex].rank
        let rightRank = group[rightIndex].rank
        newExpr = expression.transform( function (node, path, parent) {
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
            else {return node} })
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
            case 'mv': // This is not currently working for abs(amount) > 1 
                const dir = op.amount > 0 ? +1 : -1
                const startIndex = op.index;
                const endIndex = startIndex + op.amount
                let leftIndex, rightIndex
                for (let i = startIndex; i !== endIndex ; i += dir) {
                    leftIndex = math.min(startIndex, startIndex + dir)
                    rightIndex = math.max(startIndex, startIndex + dir)
                    group = availOperations[opRank].group
                    newExpression = move(newExpression, group, leftIndex, rightIndex)
                }
                break;
            case '+':
            case '-':
                let sum, sumNode, newNode, newParent
                sum = parseInt(op.fromValue)+parseInt(op.toValue)
                sumNode = new math.ConstantNode(math.abs(sum))
                if ( math.max(op.fromIndex,op.toIndex) === 1 ) {   //toParent === fromParent || (op.group[op.fromIndex].fn === 'unaryMinus' && fromParent == toParent + 1) || (op.group[op.toIndex].fn === 'unaryMinus' && fromParent == toParent - 1) ) {
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

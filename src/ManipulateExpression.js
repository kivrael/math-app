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
    let nodes = []
    let availOperations

    useEffect(() => {
        setExpressionTree(math.parse(submitInput))
        expressionHistory.current = []
    }, [submitInput])


    function getAvailableOperations(expression) {

        let commuteGroup,
        fillingCommuteGroup = false, 
        numNewElements;
        availOperations = [];
        
        setNodeRanks(expression)
        saveNodes(expression)
        //console.log(nodes)
        
        expression.traverse(function (node, path, parent) {
            let groupType = newCommuteGroupType(node,parent)
            if (groupType) { 
                commuteGroup = createCommuteGroup(groupType)
                fillingCommuteGroup = true
            }
            if (fillingCommuteGroup && node.op) {   // why need node.op?
                numNewElements = commuteGroup.addElementsFromChildren(node)
                if (numNewElements === 2 || ( node.fn === 'unaryMinus' && numNewElements === 1 ) ) {
                    commuteGroup.elements.sort(function(a,b) { return a.rank - b.rank })
                    commuteGroup.fillAvailableOperations()
                    fillingCommuteGroup = false
                }
            }
        })
        //console.log(availOperations)
    }


    function setNodeRanks(expression) {
        let rank = 0
        expression.traverse( node => { node.rank = rank; rank++; })
    }

    function saveNodes(expression) {
        nodes = []
        expression.traverse( node => { nodes.push(node) })
    }

    function newCommuteGroupType(node,parent) {

        switch (node.op) {
            case '+':
            case '-':
                if (node.rank === 0 || (parent.op!=='+' && parent.op!=='-') ) { 
                    if (node.fn === 'unaryMinus') { return false }
                    else { return 'sum' } }
                break;
            case '*':
                if (node.rank === 0 || parent.op !== '*' ) { return 'product' }
                break;
            default:
            }
        return false
    }

    function createCommuteGroup(groupType) {

        let elements = []

        return {
            elements,
            ...( groupType === 'sum' && {...createSum(elements)} ),
            ...( groupType === 'product' && {...createProduct(elements)} )
        }
    }


    function createSum(elements) {
        return  {
            addElementsFromChildren: (node) => { 
                let newElements = getElementsFromChildrenInSum(node)
                elements.push(...newElements) 
                return newElements.length
            },
            fillAvailableOperations: () => {
                addMoveOperations(elements);
                addSumOperations(elements)
            },
        }
    }

    function createProduct(elements) {
        return  {
            addElementsFromChildren: (node) => { 
                let newElements = getElementsFromChildrenInProduct(node)
                elements.push(...newElements) 
                return newElements.length
            },
            fillAvailableOperations: () => {
                addMoveOperations(elements);
                addProductOperations(elements);
                addNegativeProductOperations(elements)
            }
        }
    }


    function getElementsFromChildrenInSum(node) {

        let sign, fn, childrenElements=[];

        node.args.forEach((child,index) => {
            if ( child.op !== '+' && child.op !== '-' ) {
                    if ( index === 0 && node.fn === 'subtract' ) { sign = '+' }
                    else { sign = node.op }
                    if ( index === 0 && node.fn !== 'unaryMinus' ) { fn = 'add' }
                    else { fn = node.fn }
                childrenElements.push({
                    type:'sum',
                    sign:sign,
                    rank:child.rank,
                    value:child.toString({parenthesis: 'auto'}),
                    fn:fn
                })
            }
        })
        return childrenElements
    }

    function getElementsFromChildrenInProduct(node) {

        let childrenElements=[];

        node.args.forEach((child) => {
            if ( child.op !== '*' ) { 
                childrenElements.push({
                    type:'product',
                    rank:child.rank,
                    value:child.toString({parenthesis: 'auto'})
                })
            }
        })
        return childrenElements
    }

    function addMoveOperations(elements) {

        elements.forEach((from, fromIndex) =>  {
            elements.forEach((to,toIndex) => {
                if (toIndex !== fromIndex) {
                    let fromSign = from.op === '-' ? '-' : '',
                    amount = toIndex-fromIndex,
                    direction = amount > 0 ? 'right' : 'left',
                    absoluteAmount = math.abs(amount),
                    target = `to the ${direction}`
                    target += absoluteAmount === 1 ? '' : ` ${absoluteAmount} times`
                    elements[0].type === 'sum' && availOperations.push({  
                        type: 'move',
                        name: `move ${fromSign}${from.value} ${target}`,
                        key: `mv${from.rank}${target}`,
                        execute: () => move(elements, fromIndex, amount)
                    })
                    if ( elements[0].type === 'product' ) {
                            math.max(fromIndex,toIndex) === 1 && availOperations.push({  
                            type: 'move',
                            name: `move ${fromSign}${from.value} ${target}`,
                            key: `mv${from.rank}${target}`,
                            execute: () => move(elements, fromIndex, amount)
                        })
                    }
                }
            })
        })
    }

    function addSumOperations(elements) {

        let toSign, opName;

        elements.forEach((from, fromIndex) =>  {
            elements.forEach((to,toIndex) => {
                if (toIndex !== fromIndex) {
                    toSign = to.sign === '-' ? '-' : ''
                    if ( nodes[to.rank].isConstantNode && nodes[from.rank].isConstantNode ) {
                        opName = from.sign === '+' ? 'add' : from.sign === '-' ? 'subtract' : 'multiply'
                        availOperations.push({
                            type: opName,
                            name: `${opName} ${from.value} to ${toSign} ${to.value}`,
                            key: `${opName}${from.rank}to${to.rank}`,
                            execute: () => add(elements, fromIndex, toIndex),
                        })
                    }
                }
            })
        })
    }

    function addProductOperations(elements) {

        let toSign;

        elements.forEach((from, fromIndex) =>  {
            elements.forEach((to,toIndex) => {
                if (toIndex !== fromIndex) {
                    if ( nodes[to.rank].isConstantNode && nodes[from.rank].isConstantNode ) {
                        toSign = to.sign === '-' ? '-' : ''
                        math.max(fromIndex,toIndex) === 1 && availOperations.push({
                            type:'multiply',
                            name:`multiply ${from.value} with ${toSign}${to.value}`,
                            key:`multiply${from.rank}with${to.rank}`,
                            execute: () => multiply(elements,fromIndex,toIndex)
                        })
                    }
                }
            })
        })
    }
    
    function addNegativeProductOperations(elements) {
        
        let toSign;

        elements.forEach((from, fromIndex) =>  {
            elements.forEach((to,toIndex) => {
                if (toIndex !== fromIndex) {
                    if ( nodes[to.rank].fn === 'unaryMinus' || nodes[from.rank].fn === 'unaryMinus' ) {
                        toSign = to.sign === '-' ? '-' : ''
                        math.max(fromIndex,toIndex) === 1 && availOperations.push({
                            type:'negativeProduct',
                            name:`product with negative : ${from.value} with ${toSign}${to.value}`,
                            key:`negprod${from.rank}with${to.rank}`,
                            execute: () => multiplyWithNegative(elements,fromIndex,toIndex)
                        })
                    }
                }
            })
        })
    }


    function move(commutingElements, fromIndex, amount) {

        expressionHistory.current.push(expressionTree.toString())
        
        const direction = amount > 0 ? +1 : -1
        const startIndex = fromIndex;
        const endIndex = startIndex + amount
        let leftIndex
        let newExpression = expressionTree

        for (let i = startIndex; i !== endIndex ; i += direction) {
            leftIndex = math.min(i, i + direction)
            if (commutingElements[0].type === 'sum') {
                newExpression = swapInSum(newExpression, commutingElements, leftIndex)
            }
            else if (commutingElements[0].type === 'product') {
                newExpression = swapInProduct(newExpression, commutingElements, leftIndex)
            }
            setNodeRanks(newExpression)
            saveNodes(newExpression)
        }
        setExpressionTree(newExpression)
    }

    function swapInSum(expression, commutingElements, leftIndex) {

        let rightIndex = leftIndex+1
        let leftRank = commutingElements[leftIndex].rank
        let rightRank = commutingElements[rightIndex].rank
        let newNode, rankSpecialChange = 0

        let newExpression = expression.transform( function (node, path) {
            if ( node.isOperatorNode && node.fn === 'unaryMinus' ) {
                if ( node.args[0].rank === leftRank ) {
                    newNode = commutingElements[rightIndex].sign === '-' ? new math.OperatorNode('-','unaryMinus',[nodes[commutingElements[rightIndex].rank]]) : nodes[commutingElements[rightIndex].rank]
                    rankSpecialChange = commutingElements[rightIndex].sign === '-' ? 0 : -1                       
                return newNode
                }
                else { return node }
            }
            else if ( node.isOperatorNode && node.args[1].rank === rightRank ) {
                node.op = commutingElements[leftIndex].sign
                if ( commutingElements[leftIndex].fn === 'unaryMinus' ) { node.fn = 'subtract' }
                else { node.fn = commutingElements[leftIndex].fn }
                return node
                }
            else if ( node.isOperatorNode && node.args[1].rank === leftRank ) { 
                node.op = commutingElements[rightIndex].sign; node.fn = commutingElements[rightIndex].fn; return node }
            else if ( node.rank === leftRank ) {
                if ( path === 'args[0]' && commutingElements[rightIndex].sign === '-' ) {
                    rankSpecialChange = 1
                    return new math.OperatorNode('-','unaryMinus',[nodes[commutingElements[rightIndex].rank]]) }
                else { 
                    return nodes[rightRank] } }
            else if ( node.rank === rightRank ) { 
                return nodes[leftRank] }
            else { return node}
        })

        commutingElements[leftIndex].rank+=1
        commutingElements[rightIndex].rank-=1
        commutingElements.splice(leftIndex,2,commutingElements[rightIndex],commutingElements[leftIndex])
        commutingElements.forEach( element => element.rank += rankSpecialChange)

        return newExpression
    } 

    function swapInProduct(expression, commutingElements, leftIndex) {   // 2*-3*4 -> move 4 to the left two times //2*-3*-4

        let rightIndex = leftIndex+1
        let leftRank = commutingElements[leftIndex].rank
        let rightRank = commutingElements[rightIndex].rank

        let newExpression = expression.transform( function (node, path) {
            if ( node.rank === leftRank ) { return nodes[rightRank] }
            else if ( node.rank === rightRank ) { return nodes[leftRank] }
            else { return node }
        })

        commutingElements[leftIndex].rank+=1
        commutingElements[rightIndex].rank-=1
        commutingElements.splice(leftIndex,2,commutingElements[rightIndex],commutingElements[leftIndex])

        return newExpression
    } 

    function add(commutingElements,fromIndex,toIndex) {

        let fromValue = commutingElements[fromIndex].value,
        toValue = commutingElements[toIndex].value,
        fromRank = commutingElements[fromIndex].rank,
        toRank = commutingElements[toIndex].rank,
        fromParent, toParent, sum, sumNode, newNode, newParent, newExpression

        expressionHistory.current.push(expressionTree.toString())

        expressionTree.traverse(function (node, path, parent) {
            if (node.rank === fromRank) { fromParent = parent.rank }
            else if ( node.rank === toRank ) { toParent = parent.rank }
        })
        sum = parseInt(fromValue)+parseInt(toValue)
        sumNode = new math.ConstantNode(math.abs(sum))
        if ( math.max(fromIndex,toIndex) === 1 ) {
            newExpression = expressionTree.transform(function (node) {
                newParent = fromParent === toParent - 1 ? fromParent : toParent
                if ( node.rank === newParent ) { 
                    if ( sum > 0 ) { return sumNode }
                    else { return new math.OperatorNode('-','unaryMinus',[sumNode]) } }
                else { return node }
            }) }
        else {
            if ( toIndex === 0 ) {
                newExpression = expressionTree.transform(function (node) {
                    newNode = commutingElements[0].fn === 'unaryMinus' ? toParent : toRank
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
            setNodeRanks(newExpression)
            if ( fromIndex === 0 ) {
                newExpression = newExpression.transform(function (node) {
                    newNode = commutingElements[0].fn === 'unaryMinus' ? fromParent - 1 : fromParent
                    if ( node.rank === newNode ) {
                        return node.op === '+' ? node.args[1] : new math.OperatorNode('-','unaryMinus',[node.args[1]]) }
                    else { return node } }) }
            else {
                newExpression = newExpression.transform(function (node) {
                    if ( node.rank === fromParent ) { return node.args[0].rank === fromRank ? node.args[1] : node.args[0] }
                    else { return node }
                }) }
        }
        setExpressionTree(newExpression)
    }

    function multiply(commutingElements, fromIndex, toIndex) {

        let toRank = commutingElements[toIndex].rank,
        toParent, product, productNode, newExpression

        expressionHistory.current.push(expressionTree.toString())

        expressionTree.traverse(function (node, path, parent) {
            if ( node.rank === toRank ) { toParent = parent.rank }
        })

        product = parseInt(commutingElements[fromIndex].value)*parseInt(commutingElements[toIndex].value)
        productNode = new math.ConstantNode(math.abs(product))
        if ( math.max(toIndex,fromIndex) === 1 ) {
            newExpression = expressionTree.transform(function (node) {
                if ( node.rank === toParent ) { return productNode }
                else { return node }
            })
        }
        else {newExpression = expressionTree}
        setExpressionTree(newExpression)
    }

    function multiplyWithNegative(commutingElements, fromIndex, toIndex) {

        let toRank = commutingElements[toIndex].rank,
        fromRank = commutingElements[fromIndex].rank,
        toParent, newExpression

        expressionHistory.current.push(expressionTree.toString())

        expressionTree.traverse(function (node, path, parent) {
            if ( node.rank === toRank ) { toParent = parent.rank }
        })

        if ( math.max(toIndex,fromIndex) === 1 ) {
            if ( nodes[toRank].fn === 'unaryMinus' && nodes[fromRank].fn === 'unaryMinus' ) {
                newExpression = expressionTree.transform(function (node) {
                    if ( [toRank,fromRank].includes(node.rank) ) { return node.args[0] }
                    else { return node }
                }) }
            else {
                newExpression = expressionTree.transform(function (node) {
                    if ( [toRank,fromRank].includes(node.rank) && node.fn === 'unaryMinus' ) { return node.args[0] }
                    else { return node }
                })
                setNodeRanks(newExpression)
                newExpression = newExpression.transform(function (node) {
                    if ( node.rank === toParent ) { return new math.OperatorNode('-','unaryMinus',[new math.ParenthesisNode(node)]) }
                    else { return node }
                })
            }
        }              
        else {newExpression = expressionTree}
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

    function removeExtraParenthesis() {
        let unnecessaryParenthesis = false
        let newExpression = expressionTree.transform(function (node) {
            if ( node.isParenthesisNode && ( node.content.isConstantNode || node.content.fn === 'unaryMinus' ) ) { unnecessaryParenthesis = true; return node.content }
            else { return node }
        })
        if (unnecessaryParenthesis) { setExpressionTree(newExpression) }
    }

    removeExtraParenthesis()
    getAvailableOperations(expressionTree)
    //console.log(availOperations)

    return (
        <>
            <BlockMath>{"\\color{white} "+expressionTexString}</BlockMath>
            <OperationList availOperations={availOperations}/>
            <button onClick={handleUndo}>undo</button>
            <button onClick={handleReset}>reset</button>
        </>
    )
}

import React from 'react'

export default function OperationList({availOperations, executeOperation}) {
    let buttons = []
    availOperations.forEach( (op,index) => { 
        if ( op.type === 'mv' ) {
            buttons.push( <button key={op.key} onClick={(e) => executeOperation(index)}>{op.name}</button> )
        }  
    })
    buttons.push( <p key='vspace'></p> )
    availOperations.forEach( (op,index) => { 
        if ( op.type === '+' ) {
            buttons.push( <button key={op.key} onClick={(e) => executeOperation(index)}>{op.name}</button> )
        }  
    })
    buttons.push( <p key='vspace2'></p> )
    availOperations.forEach( (op,index) => { 
        if ( op.type === '-' ) {
            buttons.push( <button key={op.key} onClick={(e) => executeOperation(index)}>{op.name}</button> )
        }  
    })
    return buttons
}

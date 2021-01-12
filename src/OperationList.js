import React from 'react'

export default function OperationList({availOperations}) {
    let buttons = []
    const allOperations = ['move', 'add', 'subtract', 'multiply', 'negativeProduct']

    for (let operationType of allOperations) {
        availOperations.forEach( (operation,index) => { 
            if ( operation.type === operationType ) {
                buttons.push( <button key={operation.key} onClick={(e) => operation.execute()}>{operation.name}</button> )
            }  
        })
        buttons.push( <p key={'vspace'+operationType}></p> )
    }

    return buttons
}

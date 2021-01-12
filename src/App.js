import React, { useState } from 'react';
import './App.css';
import ManipulateExpression from './ManipulateExpression';
import * as math from 'mathjs'

function App() {

  const suggestedInput = '-2*(-3+4+5)' // '-5+(8+9)/2+1' // '2-3+4'

  const [input, setInput] = useState(suggestedInput)
  const [submitInput, setSubmitInput] = useState()
  const [inputSubmitted, setInputSubmitted] = useState(false)
  const [inputClicked, setInputClicked] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  const textStyle = { color: 'white', fontSize: '20px' }

  function handleOnChangeInput(e) { setInput(e.target.value) }
  function handleOnClickInputBox(e) { 
    e.target.select()
    if(!inputClicked) {setInputClicked(true)}; 
    }
  function handleOnKeyDown(e) { if (e.keyCode === 13) { handleSubmit() } }
  function handleSubmit() { 
    if (input!=='') {
      try { math.parse(input)
        setSubmitInput(input) 
        setInputSubmitted(true)
        setInput('')
        setSubmitError(false)
        math.parse(input).traverse(function(node) { if ( node.fn === 'unaryPlus' || ( node.fn === 'unaryMinus'  &&  ['unaryMinus','unaryPlus'].includes(node.args[0].fn) ) )  setSubmitError(true) } )
      }
      catch(err) { setSubmitError(true) }
    }
  }

  return (
    <>
      <p></p>
      <label style={textStyle}>Enter your expression:</label>
      <input className='input' 
        type='text' 
        style={{color:inputClicked?'black':'grey'}} 
        value={input}
        onChange={handleOnChangeInput} 
        onClick={handleOnClickInputBox} 
        onKeyDown={handleOnKeyDown}/>
      <button className='submit' onClick={handleSubmit}>submit</button>
      {inputSubmitted && !submitError &&
        <ManipulateExpression submitInput={submitInput}/>
      }
      {submitError &&
        <p style={textStyle}>Syntax error</p>
      }
    </>
  )
}

export default App;

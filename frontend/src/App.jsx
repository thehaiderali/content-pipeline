import React from 'react'
import { Route, Routes } from 'react-router'
import Home from './pages/Home'
import Videos from './pages/Videos'
import Transcribe from './pages/Transcribe'

const App = () => {
  return (
    <Routes>
      <Route path='/' element={<Home/>}/>
      <Route path='/videos' element={<Videos/>}/>
       <Route path='/videos/:name/transcribe' element={<Transcribe/>}/>
    </Routes>
  )
}

export default App
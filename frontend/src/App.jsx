import React from 'react'
import { Route, Routes } from 'react-router'
import Home from './pages/Home'
import Videos from './pages/Videos'

const App = () => {
  return (
    <Routes>
      <Route path='/' element={<Home/>}/>
      <Route path='/videos' element={<Videos/>}/>
    </Routes>
  )
}

export default App
import React from 'react'
import UploadView from '../components/UploadView'
import { Link } from 'react-router'
const Home = () => {
  return (
    <div className='w-full min-h-screen flex flex-col gap-12  justify-center items-center'>
        <UploadView/>
        <Link to="/videos" className='text-lg font-semibold underline '> Check Videos Here  </Link>
    </div>
  )
}

export default Home
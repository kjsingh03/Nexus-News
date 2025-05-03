import './App.css'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from './store/store'
import { setNavOpen } from './store'

function App() {

  const dispatch = useDispatch();

  const { navOpen } = useSelector((state: RootState) => state.ui)

  const handleClick = () => {
    dispatch(setNavOpen(!navOpen))
  }

  console.log(navOpen)

  return (
    <>
      <button onClick={handleClick} className="border border-amber-400 px-4 py-2 rounded-2xl m-4">
          Check
      </button>
    </>
  )
}

export default App

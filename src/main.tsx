import React from 'react'
import ReactDOM from 'react-dom/client'
import { Reshaped } from 'reshaped'
import LearningManagementSystem from './LearningManagementSystem'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Reshaped>
      <LearningManagementSystem />
    </Reshaped>
  </React.StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Reshaped } from 'reshaped'
import LearningManagementSystem from './LearningManagementSystem'
import { LanguageProvider } from './i18n/LanguageContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Reshaped>
      <LanguageProvider>
        <LearningManagementSystem />
      </LanguageProvider>
    </Reshaped>
  </React.StrictMode>,
)

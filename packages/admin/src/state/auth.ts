import { createContext, useContext } from 'react'

export interface AuthContextValue {
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue>({ logout: () => {} })

export const useAuth = () => useContext(AuthContext)

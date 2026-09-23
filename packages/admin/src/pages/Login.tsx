import { useState, type FormEvent } from 'react'

export const Login = ({ onSubmit }: { onSubmit: (token: string) => void }) => {
  const [token, setToken] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = token.trim()
    if (value) onSubmit(value)
  }
  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>Fanta Monitor<small>埋点数据后台</small></div>
        </div>
        <h1>登录管理后台</h1>
        <div className="field">
          <label htmlFor="token-input">访问令牌</label>
          <input id="token-input" type="password" autoComplete="off" autoFocus value={token} onChange={(e) => { setToken(e.target.value); }} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!token.trim()}>进入</button>
        <p>令牌为采集服务环境变量 <code>ADMIN_TOKEN</code> 的值，仅保存在当前浏览器的 localStorage。</p>
      </form>
    </main>
  )
}

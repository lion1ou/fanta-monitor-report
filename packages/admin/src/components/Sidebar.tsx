import { SECTIONS, hrefOf, type SectionId } from '../state/route'

export const Sidebar = ({ active, onLogout }: { active: SectionId, onLogout: () => void }) => (
  <aside className="sidebar">
    <div className="brand">
      <span className="brand-mark" aria-hidden="true" />
      <div>
        Fanta Monitor
        <small>埋点数据后台</small>
      </div>
    </div>
    <nav className="nav" aria-label="板块导航">
      {SECTIONS.map((section) => (
        <a key={section.id} href={hrefOf(section.id)} aria-current={section.id === active ? 'page' : undefined}>{section.label}</a>
      ))}
    </nav>
    <div className="sidebar-foot">
      <span>UV 口径：canvas 指纹，空指纹回退设备 uuid</span>
      <button type="button" className="link-button" onClick={onLogout}>退出登录</button>
    </div>
  </aside>
)

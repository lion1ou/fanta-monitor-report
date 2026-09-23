// ip2region.js 3.1.8 的类型声明漏掉了运行时导出的校验函数，这里以模块增强方式补齐
import 'ip2region.js'

declare module 'ip2region.js' {
  export function verifyFromFile (dbPath: string): void
}

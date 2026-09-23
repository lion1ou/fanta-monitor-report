// jsdom 没有 canvas 实现；提供一个只记录调用、不绘制的 2D 上下文桩，让指纹逻辑可以跑通
const noop = () => {}
const fakeContext = {
  rect: noop, fillRect: noop, fillText: noop, beginPath: noop, arc: noop, closePath: noop, fill: noop,
  textBaseline: '', fillStyle: '', font: '', globalCompositeOperation: ''
}
HTMLCanvasElement.prototype.getContext = (() => fakeContext) as unknown as HTMLCanvasElement['getContext']
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,fake-canvas'

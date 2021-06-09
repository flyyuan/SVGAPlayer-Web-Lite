const WORKER = `onmessage = function () {
  setTimeout(function() {postMessage(null)}, 1 / 60)
}`

/**
 * 动画处理
 */
export default class Animator {
  public _currentTimeMillsecond: () => number = () => {
    if (typeof performance === 'undefined') {
      return new Date().getTime()
    }

    return performance.now()
  }

  public noExecutionDelay: boolean = false
  public startValue: number = 0
  public endValue: number = 0
  public duration: number = 0
  public loop: number = 1
  public fillRule: number = 0

  public onStart: () => any = () => {}
  public onUpdate: (currentValue: number) => any = () => {}
  public onEnd: () => any = () => {}

  public start (currentValue: number) {
    this.doStart(currentValue)
  }

  public stop () {
    this._doStop()
  }

  public get animatedValue (): number {
    return ((this.endValue - this.startValue) * this._currentFrication) + this.startValue
  }

  private _isRunning = false
  private _mStartTime = 0
  private _currentFrication: number = 0.0
  private _worker: Worker | null = null

  private doStart (currentValue: number) {
    this._isRunning = true
    this._mStartTime = this._currentTimeMillsecond()

      // 计算开始时间和当前帧时间
    currentValue && (this._mStartTime -= currentValue / (this.endValue - this.startValue) * this.duration)

    this._currentFrication = 0.0

    if (this.noExecutionDelay && this._worker === null) {
      this._worker = new Worker(window.URL.createObjectURL(new Blob([WORKER])))
    }

    this.onStart()
    this._doFrame()
  }

  private _doStop () {
    this._isRunning = false

    if (this._worker !== null) {
      this._worker.terminate()
      this._worker = null
    }
  }

  /**
   * 更新当前帧
   */
  private _doFrame () {
    if (this._isRunning) {
      this._doDeltaTime(this._currentTimeMillsecond() - this._mStartTime)

      if (this._isRunning) {
        if (this._worker) {
          // 更新当前帧 index
          this._worker.onmessage = this._doFrame.bind(this)
          this._worker.postMessage(null)
        } else {
          // 根据 requestAnimationFrame 时机更新当前帧 index
          window.requestAnimationFrame(this._doFrame.bind(this))
        }
      }
    }
  }

  private _doDeltaTime (deltaTime: number) {
    /**
    * deltaTime 当前时间与开始播放时间间隔时长
    * duration 动画时长
    * loop 循环次数
    * 如果 deltaTime 大于 duration * loop 则代表播放结束，小于就没播完
    */
    if (deltaTime >= this.duration * this.loop) {
      this._currentFrication = this.fillRule === 1 ? 0.0 : 1.0
      this._isRunning = false
    } else {
      this._currentFrication = (deltaTime % this.duration) / this.duration
    }

    this.onUpdate(this.animatedValue)

    if (this._isRunning === false) {
      if (this._worker !== null) {
        this._worker.terminate()
        this._worker = null
      }

      this.onEnd()
    }
  }
}

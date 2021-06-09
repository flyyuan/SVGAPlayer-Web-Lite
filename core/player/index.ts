import Renderer from './renderer'
import Animator from './animator'

enum EVENT_TYPES {
  START = 'start',
  RESUME = 'resume',
  PROCESS = 'process',
  PAUSE = 'pause',
  STOP = 'stop',
  END = 'end',
  CLEAR = 'clear'
}

interface options {
  loop: number | boolean
  fillMode: FILL_MODE
  playMode: PLAY_MODE
  startFrame: number
  endFrame: number
  cacheFrames: boolean
  intersectionObserverRender: boolean
  noExecutionDelay: boolean
}

enum FILL_MODE {
  FORWARDS = 'forwards',
  BACKWARDS = 'backwards'
}

enum PLAY_MODE {
  FORWARDS = 'forwards',
  FALLBACKS = 'fallbacks'
}

const inBrowser = typeof window !== 'undefined'
const hasIntersectionObserver = inBrowser && 'IntersectionObserver' in window

export default class Player {
  public container: HTMLCanvasElement
  public loop: number | boolean = true
  public fillMode: FILL_MODE = FILL_MODE.FORWARDS
  public playMode: PLAY_MODE = PLAY_MODE.FORWARDS
  public progress: number = 0
  public currentFrame: number = 0
  public totalFramesCount: number = 0
  public startFrame: number = 0
  public endFrame: number = 0
  public cacheFrames = false
  public intersectionObserverRender = false
  public intersectionObserverRenderShow = true
  private _intersectionObserver: IntersectionObserver | null = null
  private _renderer: any
  private _animator: any

  /**
   * 注入 container 容器
   * 实例化 _renderer 和 _animator
   * @param element 
   * @param videoItem 
   * @param options 
   */
  constructor (element: string | HTMLCanvasElement, public videoItem: VideoEntity, options?: options) {
    this.container = typeof element === 'string' ? <HTMLCanvasElement>document.body.querySelector(element) : element

    if (!this.container) {
      throw new Error('container undefined.')
    }

    if (!this.container.getContext) {
      throw new Error('container should be HTMLCanvasElement.')
    }
    // Renderer 是渲染处理 和 Animator 是动画处理
    this._renderer = new Renderer(this)
    this._animator = new Animator()
    // videoItem 是什么，为什么 mount
    this.videoItem && this.mount(videoItem)

    if (options) {
      this.set(options)
    }
  }

  public set (options: options) {
    typeof options.loop !== 'undefined' && (this.loop = options.loop)
    options.fillMode && (this.fillMode = options.fillMode)
    options.playMode && (this.playMode = options.playMode)
    options.cacheFrames !== undefined && (this.cacheFrames = options.cacheFrames)
    this.startFrame = options.startFrame ? options.startFrame : this.startFrame
    this.endFrame = options.endFrame ? options.endFrame : this.endFrame

    // 监听容器是否处于浏览器视窗内
    options.intersectionObserverRender !== undefined && (this.intersectionObserverRender = options.intersectionObserverRender)
    if (hasIntersectionObserver && this.intersectionObserverRender) {
      this._intersectionObserver = new IntersectionObserver(entries => {
        if (entries[0].intersectionRatio <= 0) {
          this.intersectionObserverRenderShow && (this.intersectionObserverRenderShow = false)
        } else {
          !this.intersectionObserverRenderShow && (this.intersectionObserverRenderShow = true)
        }
      }, {
        rootMargin: '0px',
        threshold: [0, 0.5, 1]
      })
      this._intersectionObserver.observe(this.container)
    } else {
      if (this._intersectionObserver) {
        this._intersectionObserver.disconnect()
      }
      this.intersectionObserverRender = false
      this.intersectionObserverRenderShow = true
    }

    this._animator.noExecutionDelay = options.noExecutionDelay
  }

  /**
   * 挂载 SVGA 数据对象
   * @param videoItem 
   * @returns 
   */
  public mount (videoItem: VideoEntity) {
    return new Promise((resolve, reject) => {
      this.currentFrame = 0
      this.progress = 0
      this.totalFramesCount = videoItem.frames - 1
      this.videoItem = videoItem

      // TODO：_renderer.prepare 做了什么
      this._renderer.prepare().then(resolve)
      // TODO： _renderer.clear 做了什么
      this._renderer.clear()
      this._setSize()
    })
  }

  public start () {
    if (!this.videoItem) {
      throw new Error('video item undefined.')
    }
    this._renderer.clear()
    this._startAnimation()
    this.$onEvent.start()
  }

  public resume () {
    if (!this.videoItem) {
      throw new Error('video item undefined.')
    }
    this._startAnimation()
    this.$onEvent.resume()
  }

  public pause () {
    this._animator && this._animator.stop()
    this.$onEvent.pause()
  }

  public stop () {
    this._animator && this._animator.stop()
    this.currentFrame = 0
    this._renderer.drawFrame(this.currentFrame)
    this.$onEvent.stop()
  }

  public clear () {
    this._animator && this._animator.stop()
    this._renderer.clear()
    this.$onEvent.clear()
  }

  public destroy () {
    this._animator && this._animator.stop()
    this._renderer.clear()
    this._animator = null
    this._renderer = null
    this.videoItem = <any>null
  }

  private $onEvent: {
    [EVENT_TYPES.START]: Function
    [EVENT_TYPES.RESUME]: Function
    [EVENT_TYPES.PROCESS]: Function
    [EVENT_TYPES.PAUSE]: Function
    [EVENT_TYPES.STOP]: Function
    [EVENT_TYPES.END]: Function
    [EVENT_TYPES.CLEAR]: Function
  } = {
    start: () => {},
    resume: () => {},
    process: () => {},
    pause: () => {},
    stop: () => {},
    end: () => {},
    clear: () => {}
  }

  public $on (eventName: EVENT_TYPES, execFunction: Function) {
    this.$onEvent[eventName] = execFunction

    if (eventName === 'end') {
      this._animator.onEnd = () => this.$onEvent.end()
    }

    return this
  }

  /**
   * 开始播放动画
   *  */ 
  private _startAnimation () {
    const { playMode, totalFramesCount, startFrame, endFrame, videoItem } = this

    // 如果开始动画的当前帧是最后一帧，重置为第 0 帧
    if (this.currentFrame === totalFramesCount) {
      this.currentFrame = startFrame || 0
    }

    this._animator.startValue = playMode === 'fallbacks' ? (endFrame || totalFramesCount) : (startFrame || 0)
    this._animator.endValue = playMode === 'fallbacks' ? (startFrame || 0) : (endFrame || totalFramesCount)

    let frames = videoItem.frames

    if (endFrame > 0 && endFrame > startFrame) {
      frames = endFrame - startFrame
    } else if (endFrame <= 0 && startFrame > 0) {
      frames = videoItem.frames - startFrame
    }

    this._animator.duration = frames * (1.0 / videoItem.FPS) * 1000
    this._animator.loop = this.loop === true || this.loop <= 0 ? Infinity : (this.loop === false ? 1 : this.loop)
    this._animator.fillRule = this.fillMode === 'backwards' ? 1 : 0

    this._animator.onUpdate = (value: number) => {
      value = Math.floor(value)

      if (this.currentFrame === value) {
        return void 0
      }

      this.currentFrame = value

      this.progress = parseFloat((value + 1).toString()) / parseFloat(videoItem.frames.toString()) * 100

      this._renderer.drawFrame(this.currentFrame)

      this.$onEvent.process()
    }

    this._animator.start(this.currentFrame)
  }

  private _setSize () {
    const videoSize: VideoSize = this.videoItem.videoSize

    this.container.width = videoSize.width
    this.container.height = videoSize.height
  }
}

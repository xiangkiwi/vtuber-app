import { useRef } from 'react'

export default function Sidebar({ isLiveMode, onToggleLiveMode, onVrmUpload, cameraEnabled, onToggleCamera, handEnabled, onToggleHand }) {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.name.endsWith('.vrm')) {
      onVrmUpload(file)
    }
  }

  return (
    <div className="flex flex-col h-full text-white">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-purple-400">VTuber Studio</h1>
        <p className="text-xs text-gray-400 mt-1">脸部捕捉应用程式</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            模型
          </h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-left transition-colors"
          >
            📁 上传 VRM 模型
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vrm"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-gray-500 mt-2">
            支持 VRM 0.x 和 1.0 格式
          </p>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            脸部追踪
          </h2>
          <button
            onClick={onToggleCamera}
            className={`w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
              cameraEnabled
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {cameraEnabled ? '📷 停止摄像头' : '📷 开启摄像头'}
          </button>
          <div className={`mt-2 flex items-center gap-2 text-xs ${cameraEnabled ? 'text-blue-400' : 'text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cameraEnabled ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
            {cameraEnabled ? '追踪中...' : '摄像头未开启'}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            首次使用需授权摄像头权限
          </p>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            手部追踪
          </h2>
          <button
            onClick={onToggleHand}
            className={`w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
              handEnabled
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {handEnabled ? '🤚 停止手部追踪' : '🤚 开启手部追踪'}
          </button>
          <div className={`mt-2 flex items-center gap-2 text-xs ${handEnabled ? 'text-purple-400' : 'text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${handEnabled ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} />
            {handEnabled ? '手臂+手指追踪中...' : '手部追踪未开启'}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            需露出上半身，首次加载需要片刻
          </p>
        </section>
      </div>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onToggleLiveMode}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-colors ${
            isLiveMode
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isLiveMode ? '⏹ 退出实况模式' : '🎥 开始实况'}
        </button>
        {!isLiveMode && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            开始后背景变绿，用色度键扣除
          </p>
        )}
      </div>
    </div>
  )
}

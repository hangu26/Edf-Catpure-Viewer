import React, { useState, useRef } from 'react'
import './App.css'
import * as edfjs from 'edfjs'

function mapChannelName(label) {
  if (!label) return ''
  const s = label.toUpperCase()
  // Exact canonical names pass through
  const canonical = s.replace(/\s+/g, '')
  // Common mappings
  if (/^EOGL|EOGL/.test(s)) return 'E1-M2'
  if (/^EOGR|EOGR/.test(s)) return 'E2-M1'
  if (/CHIN|CHINEMG/.test(s)) return 'Chin EMG'
  if (/LLeg|LLEG|LEFT ?LEG|LLeg1/.test(s)) return 'Left Leg'
  if (/RLeg|RLEG|RIGHT ?LEG|RLeg1/.test(s)) return 'Right Leg'
  if (/ECG/.test(s)) return 'ECG'
  if (/SNOR|SNORE/.test(s)) return 'Snore'
  if (/PTAF|NASAL|NASAL.*PRESSURE|PTP|NPAF/.test(s)) return 'Flow'
  if (/THERM|THERMISTOR/.test(s)) return 'Thermistor'
  if (/THOR|THORAX|THORR?/.test(s)) return 'Thorax'
  if (/ABDO|ABD|ABDOMEN/.test(s)) return 'Abdomen'
  // Only map explicit SpO2 / saturation labels to `Saturation` (exclude OxStatus)
  if (/\bSPO2\b/.test(s) || /SATUR/.test(s)) return 'Saturation'
  // Treat audio/volume channels as snore sensor
  if (/AUDIO|PTAFVOL|VOLUME/.test(s)) return 'Snore'
  if (/X ?AXIS|ACCEL|ACCELEROMETER|XAXIS/.test(s)) return 'X Axis'
  if (/Y ?AXIS|YAXIS/.test(s)) return 'Y Axis'
  if (/Z ?AXIS|ZAXIS/.test(s)) return 'Z Axis'
  // EEG specific channels mapping: try to detect C3/C4/O1/O2 etc
  if (/C3/.test(s) && /M2/.test(s)) return 'C3-M2'
  if (/C4/.test(s) && /M1/.test(s)) return 'C4-M1'
  if (/O1/.test(s) && /M2/.test(s)) return 'O1-M2'
  if (/O2/.test(s) && /M1/.test(s)) return 'O2-M1'
  // Fallback: remove characters and try to match known labels
  const cleaned = s.replace(/[^A-Z0-9-]/g, '')
  const known = ['XAXIS','YAXIS','ZAXIS','C3-M2','C4-M1','O1-M2','O2-M1','E1-M2','E2-M1','CHINEMG','ECG','FLOW','THERMISTOR','THORAX','ABDOMEN','SNORE','AUDIOVOLUME','LEFTLEG','RIGHTLEG','SATURATION']
  for (const k of known) {
    if (cleaned.includes(k.replace(/[^A-Z0-9]/g, ''))) {
      // map back to display forms
      switch(k) {
        case 'XAXIS': return 'X Axis'
        case 'YAXIS': return 'Y Axis'
        case 'ZAXIS': return 'Z Axis'
        case 'C3-M2': return 'C3-M2'
        case 'C4-M1': return 'C4-M1'
        case 'O1-M2': return 'O1-M2'
        case 'O2-M1': return 'O2-M1'
        case 'E1-M2': return 'E1-M2'
        case 'E2-M1': return 'E2-M1'
        case 'CHINEMG': return 'Chin EMG'
        case 'ECG': return 'ECG'
        case 'FLOW': return 'Flow'
        case 'THERMISTOR': return 'Thermistor'
        case 'THORAX': return 'Thorax'
        case 'ABDOMEN': return 'Abdomen'
        case 'SNORE': return 'Snore'
        case 'AUDIOVOLUME': return 'Snore'
        case 'LEFTLEG': return 'Left Leg'
        case 'RIGHTLEG': return 'Right Leg'
        case 'SATURATION': return 'Saturation'
      }
    }
  }
  // Last resort: return the original label trimmed
  return label.trim()
}
const CHANNEL_ORDER = [
  ['', 43],
  ['', 43],
  ['', 43],
  ['C3-M2', 43],
  ['C4-M1', 43],
  ['O1-M2', 43],
  ['O2-M1', 43],
  ['E1-M2', 43],
  ['E2-M1', 43],
  ['Chin EMG', 43],
  ['ECG', 43],
  ['Flow', 129],
  ['Thermistor', 43],
  ['Thorax', 43],
  ['Abdomen', 43],
  ['Snore', 43],
  ['Audio Volume', 43],
  ['Left Leg', 43],
  ['Right Leg', 43],
  // Saturation rows: [label, pixels, [yMin, yMax]]
  ['Saturation (85-100%)', 86, [85, 100]],
  ['Saturation (40-100%)', 86, [40, 100]]
]

function drawWave(canvas, samples, sampleRate, epochStartSample, epochSamples, yRange=null) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1
  ctx.beginPath()
  const slice = samples.slice(epochStartSample, epochStartSample + epochSamples)
  if (yRange && yRange.length === 2) {
    const yMin = yRange[0]
    const yMax = yRange[1]
    for (let i = 0; i < slice.length; i++) {
      const x = Math.floor((i / (Math.max(1, slice.length - 1))) * (w - 1))
      const v = Number(slice[i])
      // map v in [yMin,yMax] to canvas y
      const t = (v - yMin) / (yMax - yMin)
      const y = Math.floor(h - (t * (h - 4) + 2))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  } else {
    const max = Math.max(...slice.map(Math.abs)) || 1
    for (let i = 0; i < slice.length; i++) {
      const x = Math.floor((i / (slice.length - 1)) * (w - 1))
      const v = slice[i] / max
      const y = Math.floor(h / 2 - v * (h / 2 - 2))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

export default function EdfViewer() {
  const [data, setData] = useState(null)
  const [epochSeconds, setEpochSeconds] = useState(30)
  const [epochIndex, setEpochIndex] = useState(0)
  const [searchEpoch, setSearchEpoch] = useState('')
  const canvasesRef = useRef([])
  const dirHandleRef = useRef(null)
  const [folderName, setFolderName] = useState('')

  const handleFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    // Cleanup previous data and canvases to release memory before loading a new file
    try {
      if (data) {
        setData(null)
      }
      if (canvasesRef && canvasesRef.current && canvasesRef.current.length) {
        canvasesRef.current.forEach(c => {
          try {
            if (c) {
              c.width = 1
              c.height = 1
            }
          } catch (e) { /* ignore */ }
        })
        canvasesRef.current.length = 0
      }
    } catch (e) {
      console.warn('cleanup before load failed', e)
    }
    if (f.name.toLowerCase().endsWith('.json')) {
      const txt = await f.text()
      const parsed = JSON.parse(txt)
      setData(parsed)
      setEpochIndex(0)
      return
    }
    try {
      // Preferred path: use edfjs.EDF class exported by the package
      if (typeof edfjs.EDF === 'function') {
        const edf = new edfjs.EDF()
        await edf.from_file(f)
        const channels = edf.channels.map((ch) => ({
          name: mapChannelName(ch.label || ch.channel || ch.name || ''),
          rawLabel: ch.label || ch.channel || ch.name || '',
          // avoid creating additional copies of large sample arrays/blobs
          samples: ch.blob || ch.samples || ch.data || [],
          sampleRate: ch.sampling_rate || ch.samplingRate || edf.sampling_rate?.[ch.label] || 100
        }))
        setData({ channels, epochSeconds })
        setEpochIndex(0)
        return
      }
      // Fallback: try other parser exports
      const arrayBuffer = await f.arrayBuffer()
      let parsed
      if (typeof edfjs.readEdf === 'function') parsed = edfjs.readEdf(arrayBuffer)
      else if (typeof edfjs.default === 'function') parsed = edfjs.default(arrayBuffer)
      else if (edfjs.default && typeof edfjs.default.readEdf === 'function') parsed = edfjs.default.readEdf(arrayBuffer)
      else if (typeof edfjs.parse === 'function') parsed = edfjs.parse(arrayBuffer)
      else throw new Error('edfjs: compatible parser export not found')
      const rawSignals = parsed.signals || parsed.channels || parsed.records || []
      const channels = rawSignals.map((s) => ({
        name: mapChannelName(s.label || s.name || s.channel || ''),
        rawLabel: s.label || s.name || s.channel || '',
        // keep parser-provided arrays/typed arrays as-is to avoid extra memory copies
        samples: s.samples || s.data || s.samplesArray || [],
        sampleRate: s.sample_rate || s.sampleRate || s.samplingRate || parsed.sample_rate || 100
      }))
      if (!channels.length) {
        alert('EDF 파서가 채널을 찾지 못했습니다.')
        return
      }
      setData({ channels, epochSeconds })
      setEpochIndex(0)
    } catch (err) {
      console.error(err)
      alert('EDF 파싱 중 오류가 발생했습니다: ' + (err && err.message ? err.message : err))
    }
  }

  const totalEpochs = React.useMemo(() => {
    if (!data) return 0
      const per = CHANNEL_ORDER.map(([_name, _pixels], rowIdx) => {
        if (!_name) return 0
        const ch = data.channels.find(c => c.name === _name) || data.channels[rowIdx]
        const sr = (ch && (ch.sampleRate || ch.sample_rate)) || 100
        const epochSamples = Math.max(1, Math.floor(sr * Math.max(1, epochSeconds)))
        return Math.ceil((ch && ch.samples ? ch.samples.length : 0) / epochSamples)
      })
    return Math.max(...per, 0)
  }, [data, epochSeconds])

  const renderEpoch = () => {
    if (!data) return
    // For each display row (CHANNEL_ORDER) find the matching channel and draw into that row's canvas
    setTimeout(() => {
      CHANNEL_ORDER.forEach((entry, rowIdx) => {
        // entry can be [name, pixels] or [name, pixels, yRange]
        const name = entry[0]
        const pixels = entry[1]
        const yRange = entry[2] || null
        let ch = null
        if (!name) {
          ch = { name: '', samples: [], sampleRate: 100 }
        } else {
          let mappedIdx = data.channels.findIndex(c => c.name === name || (c.rawLabel && c.rawLabel.toUpperCase().includes('SPO2') && name.startsWith('Saturation')))
          if ((mappedIdx == null || mappedIdx < 0) && name === 'Audio Volume') {
            // prefer channels already mapped to `Snore`, otherwise raw labels containing AUDIO/VOLUME
            mappedIdx = data.channels.findIndex(c => c.name === 'Snore' || (c.rawLabel && /AUDIO|PTAFVOL|VOLUME/.test(c.rawLabel.toUpperCase())))
          }
          ch = (mappedIdx != null && mappedIdx >= 0) ? data.channels[mappedIdx] : (data.channels[rowIdx] || null)
        }
        if (!ch) return
        const sr = (ch.sampleRate || ch.sample_rate) || 100
        const epochSamples = Math.max(1, Math.floor(sr * Math.max(1, epochSeconds)))
        const epochStart = epochIndex * epochSamples
        const canvas = canvasesRef.current[rowIdx]
        if (!canvas) return
        drawWave(canvas, ch.samples || [], sr, epochStart, epochSamples, yRange)
      })
    }, 50)
  }

  const handleNext = () => {
    if (!data) return
    setEpochIndex((i) => Math.min(i + 1, totalEpochs - 1))
  }
  const handlePrev = () => {
    if (!data) return
    setEpochIndex((i) => Math.max(i - 1, 0))
  }

  const handleGoToEpoch = () => {
    if (!data) return
    const v = Number(searchEpoch)
    if (!Number.isFinite(v) || v < 1) {
      alert('에폭 번호를 입력하세요.')
      return
    }
    const idx = Math.max(0, Math.min(totalEpochs - 1, Math.floor(v) - 1))
    setEpochIndex(idx)
  }

  // 자동 캡처 상태 및 제어
  const [isAutoCapturing, setIsAutoCapturing] = useState(false)
  const [autoDelay, setAutoDelay] = useState(800) // ms
  const autoCapturingRef = useRef(false)

  const startAutoCapture = () => {
    if (!data) return
    autoCapturingRef.current = true
    setIsAutoCapturing(true)
    runAutoCapture()
  }

  const stopAutoCapture = () => {
    autoCapturingRef.current = false
    setIsAutoCapturing(false)
  }

  const runAutoCapture = async () => {
    for (let i = epochIndex; i < totalEpochs; i++) {
      if (!autoCapturingRef.current) break
      setEpochIndex(i)
      // allow render to finish
      await new Promise(r => setTimeout(r, 350))
      try { handleCapture(i) } catch (e) { console.warn('auto capture failed', e) }
      await new Promise(r => setTimeout(r, autoDelay))
    }
    autoCapturingRef.current = false
    setIsAutoCapturing(false)
  }

  const handleCapture = (overrideIndex) => {
    // support being used directly as an onClick handler (which passes an event)
    if (overrideIndex && typeof overrideIndex === 'object' && overrideIndex.target) overrideIndex = undefined
    const idx = (overrideIndex !== undefined && overrideIndex !== null) ? overrideIndex : epochIndex
    if (!data) return
    // merge canvases vertically and scale to fixed output size 1080x1920
    const widths = canvasesRef.current.map(c => c?.width || 0)
    const heights = canvasesRef.current.map(c => c?.height || 0)
    const origW = Math.max(...widths, 800)
    const origH = Math.max(heights.reduce((a,b)=>a+b,0), 1)
    const OUT_W = 1080
    const OUT_H = 1920
    const out = document.createElement('canvas')
    out.width = OUT_W
    out.height = OUT_H
    const ctx = out.getContext('2d')
    let y = 0
    const scaleY = OUT_H / origH
    const scaleX = OUT_W / origW
    canvasesRef.current.forEach(c => {
      if (!c) return
      const srcW = c.width
      const srcH = c.height
      const destX = 0
      const destY = Math.round(y * scaleY)
      const destW = Math.round(srcW * scaleX)
      const destH = Math.round(srcH * scaleY)
      ctx.drawImage(c, 0, 0, srcW, srcH, destX, destY, destW, destH)
      y += srcH
    })
    // get blob promise
    out.toBlob(async (blob) => {
      const filename = `edf_epoch_${idx + 1}.png`
      // if user selected a directory and File System Access API available, write directly
      const dirHandle = dirHandleRef.current
      if (dirHandle && typeof dirHandle.getFileHandle === 'function') {
        try {
          const fh = await dirHandle.getFileHandle(filename, { create: true })
          const writable = await fh.createWritable()
          await writable.write(blob)
          await writable.close()
          return
        } catch (err) {
          console.warn('디렉터리에 저장 실패, 기본 다운로드로 폴백:', err)
        }
      }
      // fallback: trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const chooseFolder = async () => {
    if (!window.showDirectoryPicker) {
      alert('이 브라우저는 디렉터리 선택을 지원하지 않습니다.')
      return
    }
    try {
      const dir = await window.showDirectoryPicker()
      dirHandleRef.current = dir
      setFolderName(dir.name || '')
    } catch (err) {
      console.warn('폴더 선택 취소', err)
    }
  }

  React.useEffect(() => {
    renderEpoch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, epochIndex, epochSeconds])

  return (
    <div className="edf-viewer">
      <div style={{marginBottom:12}}>
        <input type="file" accept=".edf,.json" onChange={handleFile} />
        <label style={{marginLeft:8}}>Epoch seconds:</label>
        <input style={{width:60}} type="number" value={epochSeconds} onChange={e=>setEpochSeconds(Number(e.target.value))} />
        <button onClick={handlePrev} style={{marginLeft:8}}>Prev Epoch</button>
        <button onClick={handleNext} style={{marginLeft:8}}>Next Epoch</button>
        <input
          style={{width:90, marginLeft:8}}
          type="number"
          min={1}
          max={totalEpochs}
          placeholder="Go to epoch"
          value={searchEpoch}
          onChange={e=>setSearchEpoch(e.target.value)}
          onKeyDown={e=>{ if (e.key === 'Enter') handleGoToEpoch() }}
        />
        <button onClick={handleGoToEpoch} style={{marginLeft:4}}>Go</button>
        <button onClick={handleCapture} style={{marginLeft:8}}>Capture</button>
        <button
          onClick={() => { isAutoCapturing ? stopAutoCapture() : startAutoCapture() }}
          style={{marginLeft:8}}
        >
          {isAutoCapturing ? 'Stop' : 'Auto Capture'}
        </button>
        <label style={{marginLeft:8}}>Delay(ms):</label>
        <input style={{width:80, marginLeft:4}} type="number" value={autoDelay} onChange={e=>setAutoDelay(Math.max(100, Number(e.target.value)||100))} />
        <button onClick={chooseFolder} style={{marginLeft:8}}>Set Folder</button>
        <div style={{display:'inline-block', marginLeft:8}}>{folderName ? `Folder: ${folderName}` : ''}</div>
      </div>

      {!data && <div>EDF 파일(.edf)을 업로드하세요.</div>}

      {data && (
        <div>
          <div>Epoch {epochIndex+1} / {totalEpochs}</div>
          <div>
            {CHANNEL_ORDER.map((entry, rowIdx) => {
              const name = entry[0]
              const pixels = entry[1]
              const ch = name ? (data.channels.find(c => c.name === name) || data.channels[rowIdx]) : { name: '', samples: [], sampleRate: 100 }
              return (
                <div key={rowIdx} style={{display:'flex', alignItems:'center', marginBottom:6}}>
                  <div style={{width:160}}>{name} ({pixels}px)</div>
                  <canvas
                    ref={el => { canvasesRef.current[rowIdx] = el }}
                    width={1080}
                    height={pixels}
                    style={{border:'1px solid #333', background:'#111'}}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

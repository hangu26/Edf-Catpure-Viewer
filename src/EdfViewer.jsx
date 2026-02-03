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
  if (/X ?AXIS|ACCEL|ACCELEROMETER|XAXIS/.test(s)) return 'Position'
  if (/Y ?AXIS|YAXIS/.test(s)) return 'Position'
  if (/Z ?AXIS|ZAXIS/.test(s)) return 'Position'
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
        case 'XAXIS': return 'Position'
        case 'YAXIS': return 'Position'
        case 'ZAXIS': return 'Position'
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
  ['Position', 43],
  ['Position', 43],
  ['Position', 43],
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

// Draw a wave directly into an existing 2D context rect (used for high-res programmatic captures)
function drawWaveIntoCtx(ctx, destX, destY, destW, destH, samples, sampleRate, epochStart, epochSamples, yRange=null) {
  const slice = (samples && samples.slice) ? samples.slice(epochStart, epochStart + epochSamples) : []
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.fillRect(destX, destY, destW, destH)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1
  ctx.beginPath()
  if (yRange && yRange.length === 2) {
    const yMin = yRange[0]
    const yMax = yRange[1]
    for (let i = 0; i < slice.length; i++) {
      const x = destX + Math.floor((i / (Math.max(1, slice.length - 1))) * (destW - 1))
      const v = Number(slice[i])
      const t = (v - yMin) / (yMax - yMin)
      const y = destY + Math.floor(destH - (t * (destH - 4) + 2))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  } else {
    const max = slice.length ? Math.max(...Array.from(slice, Math.abs)) : 1
    const norm = max || 1
    for (let i = 0; i < slice.length; i++) {
      const x = destX + Math.floor((i / (Math.max(1, slice.length - 1))) * (destW - 1))
      const v = slice[i] / norm
      const y = destY + Math.floor(destH / 2 - v * (destH / 2 - 2))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
  ctx.restore()
}

export default function EdfViewer() {
  const [data, setData] = useState(null)
  const [epochSeconds, setEpochSeconds] = useState(30)
  const [epochIndex, setEpochIndex] = useState(0)
  const [searchEpoch, setSearchEpoch] = useState('')
  const canvasesRef = useRef([])
  const dirHandleRef = useRef(null)
  const [folderName, setFolderName] = useState('')
  const [folderCaptureRunning, setFolderCaptureRunning] = useState(false)
  const folderCaptureRef = useRef(false)
  const [folderCaptureStatus, setFolderCaptureStatus] = useState('')
  const [folderFilesTotal, setFolderFilesTotal] = useState(0)
  const [folderFilesIndex, setFolderFilesIndex] = useState(0)
  const [folderEpochIndex, setFolderEpochIndex] = useState(0)
  const [folderEpochTotal, setFolderEpochTotal] = useState(0)
  const [folderLogs, setFolderLogs] = useState([])

  function pushFolderLog(msg) {
    setFolderLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`].slice(-300))
  }

  const epochDebug = React.useMemo(() => {
    if (!data) return null
    const epochLenSec = Math.max(1, epochSeconds)
    // pick a representative channel (first with samples)
    const ch = (data.channels || []).find(c => c && c.samples && c.samples.length) || (data.channels && data.channels[0]) || null
    if (!ch) return { startSec: epochIndex * epochLenSec, endSec: (epochIndex + 1) * epochLenSec, channel: null }
    const sr = (ch.sampleRate || ch.sample_rate) || 100
    const startSec = epochIndex * epochLenSec
    const endSec = (epochIndex + 1) * epochLenSec
    const startSample = Math.round(startSec * sr)
    const epochSamples = Math.max(1, Math.round(sr * epochLenSec))
    const endSample = startSample + epochSamples - 1
    return { startSec, endSec, channel: ch.name || ch.rawLabel || 'channel0', sr, startSample, endSample }
  }, [data, epochIndex, epochSeconds])

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
        const epochLenSec = Math.max(1, epochSeconds)
        const epochSamples = Math.max(1, Math.round(sr * epochLenSec))
        const epochStart = Math.round(epochIndex * epochLenSec * sr)
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
    // Programmatic high-resolution render (drawing from samples) at 1920x1080
    const OUT_W = 1920
    const OUT_H = 1080
    const out = document.createElement('canvas')
    out.width = OUT_W
    out.height = OUT_H
    const ctx = out.getContext('2d')
    // compute uniform row height (ignore per-channel pixel sizes)
    const rows = Math.max(1, CHANNEL_ORDER.length)
    const rowHeight = Math.max(1, Math.floor(OUT_H / rows))
    // background
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    let yAcc = 0
    CHANNEL_ORDER.forEach((entry, rowIdx) => {
      const name = entry[0]
      const pixels = entry[1] || 0
      const yRange = entry[2] || null
      let ch = null
      if (!name) {
        ch = { name: '', samples: [], sampleRate: 100 }
      } else {
        let mappedIdx = data.channels.findIndex(c => c.name === name || (c.rawLabel && c.rawLabel.toUpperCase().includes('SPO2') && name.startsWith('Saturation')))
        if ((mappedIdx == null || mappedIdx < 0) && name === 'Audio Volume') {
          mappedIdx = data.channels.findIndex(c => c.name === 'Snore' || (c.rawLabel && /AUDIO|PTAFVOL|VOLUME/.test(c.rawLabel.toUpperCase())))
        }
        ch = (mappedIdx != null && mappedIdx >= 0) ? data.channels[mappedIdx] : (data.channels[rowIdx] || null)
      }
      if (!ch) { return }
      const sr = (ch.sampleRate || ch.sample_rate) || 100
      const epochLenSec = Math.max(1, epochSeconds)
      const epochSamples = Math.max(1, Math.round(sr * epochLenSec))
      const epochStart = Math.round(idx * epochLenSec * sr)
      const destY = rowIdx * rowHeight
      // for last row include remainder to fill OUT_H exactly
      const destH = (rowIdx === rows - 1) ? (OUT_H - destY) : rowHeight
      const destW = OUT_W
      drawWaveIntoCtx(ctx, 0, destY, destW, destH, ch.samples || [], sr, epochStart, epochSamples, yRange)
      // no yAcc when using uniform rows
    })
    out.toBlob(async (blob) => {
      const filename = `edf_epoch_${idx + 1}.png`
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

  // --- EDF/JSON 파일 파싱 헬퍼 ---
  async function parseEdfOrJsonFile(file) {
    try {
      if (!file) throw new Error('no file')
      if (file.name.toLowerCase().endsWith('.json')) {
        const txt = await file.text()
        return JSON.parse(txt)
      }
      if (typeof edfjs.EDF === 'function') {
        const edf = new edfjs.EDF()
        await edf.from_file(file)
        const channels = edf.channels.map((ch) => ({
          name: mapChannelName(ch.label || ch.channel || ch.name || ''),
          rawLabel: ch.label || ch.channel || ch.name || '',
          samples: ch.blob || ch.samples || ch.data || [],
          sampleRate: ch.sampling_rate || ch.samplingRate || edf.sampling_rate?.[ch.label] || 100
        }))
        return { channels, epochSeconds }
      }
      const arrayBuffer = await file.arrayBuffer()
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
        samples: s.samples || s.data || s.samplesArray || [],
        sampleRate: s.sample_rate || s.sampleRate || s.samplingRate || parsed.sample_rate || 100
      }))
      return { channels, epochSeconds }
    } catch (err) {
      console.error('parseEdfOrJsonFile error', err)
      throw err
    }
  }

  // --- 단일 에폭 이미지 생성 및 저장 헬퍼 ---
  async function generateAndSaveEpochImage(dataObj, idx, outDirHandle, outNamePrefix = 'edf_epoch') {
    const OUT_W = 1920
    const OUT_H = 1080
    const out = document.createElement('canvas')
    out.width = OUT_W
    out.height = OUT_H
    const ctx = out.getContext('2d')
    const rows = Math.max(1, CHANNEL_ORDER.length)
    const rowHeight = Math.max(1, Math.floor(OUT_H / rows))
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    let yAcc = 0
    CHANNEL_ORDER.forEach((entry, rowIdx) => {
      const name = entry[0]
      const pixels = entry[1] || 0
      const yRange = entry[2] || null
      let ch = null
      if (!name) {
        ch = { name: '', samples: [], sampleRate: 100 }
      } else {
        let mappedIdx = (dataObj.channels || []).findIndex(c => c.name === name || (c.rawLabel && c.rawLabel.toUpperCase().includes('SPO2') && name.startsWith('Saturation')))
        if ((mappedIdx == null || mappedIdx < 0) && name === 'Audio Volume') {
          mappedIdx = (dataObj.channels || []).findIndex(c => c.name === 'Snore' || (c.rawLabel && /AUDIO|PTAFVOL|VOLUME/.test(c.rawLabel.toUpperCase())))
        }
        ch = (mappedIdx != null && mappedIdx >= 0) ? dataObj.channels[mappedIdx] : (dataObj.channels[rowIdx] || null)
      }
      if (!ch) { return }
      const sr = (ch.sampleRate || ch.sample_rate) || 100
      const epochLenSec = Math.max(1, dataObj.epochSeconds || epochSeconds)
      const epochSamples = Math.max(1, Math.round(sr * epochLenSec))
      const epochStart = Math.round(idx * epochLenSec * sr)
      const destY = rowIdx * rowHeight
      const destH = (rowIdx === rows - 1) ? (OUT_H - destY) : rowHeight
      const destW = OUT_W
      drawWaveIntoCtx(ctx, 0, destY, destW, destH, ch.samples || [], sr, epochStart, epochSamples, yRange)
      // uniform rows — no yAcc
    })
    return new Promise(async (resolve, reject) => {
      out.toBlob(async (blob) => {
        const filename = `${outNamePrefix}_${idx + 1}.png`
        if (outDirHandle && typeof outDirHandle.getFileHandle === 'function') {
          try {
            const fh = await outDirHandle.getFileHandle(filename, { create: true })
            const writable = await fh.createWritable()
            await writable.write(blob)
            await writable.close()
            resolve()
            return
          } catch (err) {
            console.warn('디렉터리 저장 실패, 기본 다운로드로 폴백:', err)
          }
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    })
  }

  // --- 데이터 객체의 모든 에폭을 순차 저장 ---
  async function captureAllEpochsForData(dataObj, outDirHandle, filePrefix = 'edf_epoch') {
    if (!dataObj || !dataObj.channels) return
    const per = CHANNEL_ORDER.map(([_name, _pixels], rowIdx) => {
      if (!_name) return 0
      const ch = dataObj.channels.find(c => c.name === _name) || dataObj.channels[rowIdx]
      const sr = (ch && (ch.sampleRate || ch.sample_rate)) || 100
      const epochSamples = Math.max(1, Math.floor(sr * Math.max(1, dataObj.epochSeconds || epochSeconds)))
      return Math.ceil((ch && ch.samples ? ch.samples.length : 0) / epochSamples)
    })
    const total = Math.max(...per, 0)
    for (let i = 0; i < total; i++) {
      await generateAndSaveEpochImage(dataObj, i, outDirHandle, filePrefix)
      await new Promise(r => setTimeout(r, Math.max(50, autoDelay || 100)))
    }
  }

  // --- 선택한 폴더 내 모든 .edf/.json 파일을 순차 처리하여 서브폴더에 저장 ---
  const stopFolderAutoCapture = () => {
    folderCaptureRef.current = false
    setFolderCaptureRunning(false)
    setFolderCaptureStatus('Stopped by user')
    pushFolderLog('Folder capture stopped by user')
  }

  const startFolderAutoCapture = async () => {
    const topDir = dirHandleRef.current
    if (!topDir) { alert('먼저 폴더를 선택하세요.'); return }
    folderCaptureRef.current = true
    setFolderCaptureRunning(true)
    setFolderLogs([])
    setFolderCaptureStatus('Starting')
    pushFolderLog('Starting folder capture')
    try {
      const files = []
      for await (const [name, handle] of topDir.entries()) {
        if (handle.kind !== 'file') continue
        const lname = name.toLowerCase()
        // include only EDF files
        if (lname.endsWith('.edf')) files.push({ name, handle })
      }
      files.sort((a, b) => {
        const na = a.name.replace(/\.[^/.]+$/, '')
        const nb = b.name.replace(/\.[^/.]+$/, '')
        const ia = parseInt(na, 10)
        const ib = parseInt(nb, 10)
        if (!Number.isNaN(ia) && !Number.isNaN(ib)) return ia - ib
        return a.name.localeCompare(b.name)
      })
      setFolderFilesTotal(files.length)
      for (let i = 0; i < files.length; i++) {
        if (!folderCaptureRef.current) break
        const { name, handle } = files[i]
        setFolderFilesIndex(i + 1)
        setFolderCaptureStatus(`Processing ${name} (${i + 1}/${files.length})`)
        pushFolderLog(`Processing file: ${name}`)
        try {
          const file = await handle.getFile()
          const dataObj = await parseEdfOrJsonFile(file)
          dataObj.epochSeconds = dataObj.epochSeconds || epochSeconds
          // compute total epochs for this dataObj
          const per = CHANNEL_ORDER.map(([_name, _pixels], rowIdx) => {
            if (!_name) return 0
            const ch = dataObj.channels.find(c => c.name === _name) || dataObj.channels[rowIdx]
            const sr = (ch && (ch.sampleRate || ch.sample_rate)) || 100
            const epochSamples = Math.max(1, Math.floor(sr * Math.max(1, dataObj.epochSeconds || epochSeconds)))
            return Math.ceil((ch && ch.samples ? ch.samples.length : 0) / epochSamples)
          })
          const totalEpochsForFile = Math.max(...per, 0)
          setFolderEpochTotal(totalEpochsForFile)
          const base = name.replace(/\.[^/.]+$/, '')
          const subdir = await topDir.getDirectoryHandle(base, { create: true })
          for (let e = 0; e < totalEpochsForFile; e++) {
            if (!folderCaptureRef.current) break
            setFolderEpochIndex(e + 1)
            setFolderCaptureStatus(`File ${base}: epoch ${e + 1}/${totalEpochsForFile}`)
            pushFolderLog(`Rendering ${base} epoch ${e + 1}/${totalEpochsForFile}`)
            await generateAndSaveEpochImage(dataObj, e, subdir, base)
            await new Promise(r => setTimeout(r, Math.max(50, autoDelay || 100)))
          }
          pushFolderLog(`Finished file: ${name}`)
        } catch (err) {
          console.warn('파일 처리 실패:', name, err)
          pushFolderLog(`Error processing ${name}: ${err && err.message ? err.message : err}`)
        }
        await new Promise(r => setTimeout(r, 200))
      }
      if (folderCaptureRef.current) {
        setFolderCaptureStatus('Completed')
        pushFolderLog('Folder capture completed')
      }
    } catch (err) {
      console.error('startFolderAutoCapture error', err)
      setFolderCaptureStatus('Error')
      pushFolderLog(`Folder capture error: ${err && err.message ? err.message : err}`)
      alert('폴더 자동 캡처 중 오류가 발생했습니다.')
    } finally {
      folderCaptureRef.current = false
      setFolderCaptureRunning(false)
    }
  }

  React.useEffect(() => {
    renderEpoch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, epochIndex, epochSeconds])

  return (
    <div className="edf-viewer">
      <div style={{marginBottom:12}}>
        <input type="file" accept=".edf" onChange={handleFile} />
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
        {folderCaptureRunning ? (
          <button onClick={stopFolderAutoCapture} style={{marginLeft:8}}>Stop Folder Capture</button>
        ) : (
          <button onClick={startFolderAutoCapture} style={{marginLeft:8}}>Folder Auto Capture</button>
        )}
        <div style={{display:'inline-block', marginLeft:8}}>{folderName ? `Folder: ${folderName}` : ''}</div>
      </div>

      <div style={{marginTop:8}}>
        <div><strong>Status:</strong> {folderCaptureStatus}</div>
        {epochDebug && (
          <div style={{marginTop:6}}>
            <div><strong>Epoch range:</strong> {epochDebug.startSec}s — {epochDebug.endSec}s</div>
          </div>
        )}
        {folderFilesTotal > 0 && (
          <div>Files: {folderFilesIndex}/{folderFilesTotal} — Epoch: {folderEpochIndex}/{folderEpochTotal}</div>
        )}
        {folderLogs.length > 0 && (
          <pre style={{height:120, overflow:'auto', background:'#111', color:'#ddd', padding:8}}>
            {folderLogs.join('\n')}
          </pre>
        )}
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
                    height={40}
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

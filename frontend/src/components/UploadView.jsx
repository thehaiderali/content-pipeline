import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button.jsx'

const UploadView = () => {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState(null)

  const handleSelectClick = () => {
    setStatus(null)
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setStatus(null)
    }
    e.target.value = ''
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    const formData = new FormData()
    formData.append('video', selectedFile)

    setUploading(true)
    setStatus(null)

    try {
      const res = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setStatus({ type: 'success', message: `Uploaded as "${data.file.filename}"` })
      setSelectedFile(null)
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen/3 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 p-8 rounded-xl border border-border shadow-sm w-full max-w-sm">
        <h1 className="text-4xl font-semibold">Upload Video</h1>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Selected file name */}
        {selectedFile && (
          <p className="text-sm text-muted-foreground truncate w-full text-center">
            {selectedFile.name}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={handleSelectClick} disabled={uploading}>
            Choose File
          </Button>

          {selectedFile && (
            <Button size="lg" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          )}
        </div>

        {/* Status message */}
        {status && (
          <p
            className={`text-sm ${
              status.type === 'success' ? 'text-green-600' : 'text-destructive'
            }`}
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  )
}

export default UploadView

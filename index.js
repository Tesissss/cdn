import express from "express"
import multer from "multer"
import crypto from "crypto"
import cors from "cors"
import fetch from "node-fetch"

const app = express()
const upload = multer({ limits: { fileSize: 30 * 1024 * 1024 } })
const C = JSON.parse(process.env.CONFIG);
const token = C.token
const repoOwner = C.owner
const repoName = C.repo

global.totalR = global.totalReq || 0
global.startTime = Date.now()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  global.totalRequests++
  next()
})

function formatUptime(ms) {
  let sec = Math.floor(ms / 1000)
  const days = Math.floor(sec / 86400)
  sec %= 86400
  const hours = Math.floor(sec / 3600)
  sec %= 3600
  const minutes = Math.floor(sec / 60)
  sec %= 60
  return `${days} d - ${hours} h - ${minutes} m - ${sec} s`
}

async function uploadToGit(name, buffer, folder) {
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folder}/${name}`
  const content = buffer.toString("base64")
  const body = { message: "Upload", content }
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) return null
  return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${folder}/${name}`
}

app.get("/", (req, res) => {
  res.json({
    status: "Alive!",
    creator: C.creator,
    endpoints: {
      upload: "POST /upload",
      file: "GET /file",
      info: "GET /info"
    }
  })
})

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.json({ status: false, error: "No file" })

  const mime = req.file.mimetype
  const isImage = mime.startsWith("image/")
  const isVideo = mime.startsWith("video/")

  if (!isImage && !isVideo) return res.json({ status: false, error: "Invalid file type" })

  const key = crypto.randomBytes(8).toString("hex")
  const ext = req.file.originalname.split(".").pop()
  const finalName = `${key}.${ext}`

  const folder = isVideo ? "video" : "imagen"

  const uploadedUrl = await uploadToGit(finalName, req.file.buffer, folder)
  if (!uploadedUrl) return res.json({ status: false, error: "GitHub upload failed" })

  const domain = req.headers.host

  res.json({
    status: true,
    data: {
      file_name: finalName,
      mimetype: mime,
      url: `https://${domain}/file?key=${finalName}`
    }
  })
})

app.get("/file", async (req, res) => {
  const key = req.query.key
  if (!key) return res.json({ status: false, error: "Missing key" })
  const ext = key.split(".").pop()
  const folder = ["mp4", "mov", "mkv", "avi"].includes(ext) ? "video" : "imagen"
  const raw = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${folder}/${key}`

  const githubRes = await fetch(raw)
  if (!githubRes.ok) return res.json({ status: false, error: "Not found" })

  const buffer = Buffer.from(await githubRes.arrayBuffer())

  res.set("Content-Type", githubRes.headers.get("content-type") || "application/octet-stream")
  res.send(buffer)
})

app.get("/info", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress
  const uptime = formatUptime(Date.now() - global.startTime)

  res.json({
    status: "online",
    creator: C.creator,
    server_time: new Date(),
    user_ip: ip,
    uptime,
    total_requests: global.totalReq
  })
})

const PORT = C.port || 3000
app.listen(PORT)

import express from "express"
import fetch from "node-fetch"
import crypto from "crypto"

const app = express()
app.use(express.raw({ type: "*/*", limit: "30mb" }))

const token = " "
const repoOwner = "Tesissss"
const repoName = "files"

function randomMessage() {
  const arr = ["sylphy", "Uploader"]
  return arr[Math.floor(Math.random() * arr.length)]
}

async function uploadFileToGitHub(folder, filePath, buffer) {
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folder}/${filePath}`
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json"
  }

  const exist = await fetch(url, { headers })
  const content = buffer.toString("base64")
  const message = randomMessage()
  const body = exist.ok
    ? { message, content, sha: (await exist.json()).sha }
    : { message, content }

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  if (!res.ok) throw new Error(res.statusText)

  return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${folder}/${filePath}`
}

function detectType(buffer) {
  const sig = buffer.subarray(0, 4).toString("hex").toUpperCase()

  const imageHeaders = [
    "FFD8FFE0", "FFD8FFE1", "FFD8FFE2",
    "89504E47",
    "47494638",
    "424D",
    "52494646",
    "49492A00",
    "4D4D002A"
  ]

  const videoHeaders = [
    "00000018", "00000020",
    "1A45DFA3",
    "66747970"
  ]

  if (imageHeaders.some(h => sig.startsWith(h))) return "imagen"
  if (videoHeaders.some(h => sig.startsWith(h))) return "video"

  return null
}

app.post("/upload", async (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.json({ error: "No buffer received" })
    if (req.body.length > 30 * 1024 * 1024) return res.json({ error: "File too large (30MB max)" })

    const type = detectType(req.body)
    if (!type) return res.json({ error: "Unsupported file type" })

    const key = crypto.randomBytes(8).toString("hex")
    const rawUrl = await uploadFileToGitHub(type, key, req.body)

    res.json({ status: true, url: rawUrl, key, type })
  } catch (e) {
    res.json({ status: false, error: e.message })
  }
})

app.get("/file", async (req, res) => {
  try {
    const { key } = req.query
    if (!key) return res.json({ error: "Missing key" })

    const possible = [
      `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/imagen/${key}`,
      `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/video/${key}`
    ]

    for (const url of possible) {
      const r = await fetch(url)
      if (r.ok) {
        const buffer = Buffer.from(await r.arrayBuffer())
        return res.end(buffer)
      }
    }

    res.status(404).json({ error: "File not found" })
  } catch (e) {
    res.json({ error: e.message })
  }
})

app.listen(3000, () => console.log("Server online"))

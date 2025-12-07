import express from "express"
import fetch from "node-fetch"
import crypto from "crypto"

const app = express()
app.use(express.raw({ type: "*/*", limit: "200mb" }))

const token = ""
const repoOwner = "Tesissss"
const repoName = "files"

function randomMessage() {
  const arr = ["Sylphy", "Uploader"]
  return arr[Math.floor(Math.random() * arr.length)]
}

async function uploadFileToGitHub(filePath, buffer) {
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/Contenido/${filePath}`
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

  return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/Contenido/${filePath}`
}

app.post("/upload", async (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.json({ error: "No file buffer received" })
    const key = crypto.randomBytes(8).toString("hex")
    const filePath = key
    const rawUrl = await uploadFileToGitHub(filePath, req.body)
    res.json({ status: true, url: rawUrl, key })
  } catch (e) {
    res.json({ status: false, error: e.message })
  }
})

app.get("/file", async (req, res) => {
  try {
    const { key } = req.query
    if (!key) return res.json({ error: "Missing key" })

    const rawUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/Contenido/${key}`
    const fileResponse = await fetch(rawUrl)

    if (!fileResponse.ok) return res.status(404).json({ error: "File not found" })

    const buffer = Buffer.from(await fileResponse.arrayBuffer())
    res.end(buffer)
  } catch (e) {
    res.json({ error: e.message })
  }
})

app.listen(3000, () =>
  console.log("Server online on port 3000")
)

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import process from 'node:process'

const handlers = {
  '/api/around-the-commons/auth/login': 'server/api/around-the-commons/auth/login.js',
  '/api/around-the-commons/auth/logout': 'server/api/around-the-commons/auth/logout.js',
  '/api/around-the-commons/ingest': 'server/api/around-the-commons/ingest.js',
  '/api/newsletter/session': 'server/api/newsletter/session.js',
  '/api/newsletter/issue': 'server/api/newsletter/issue.js',
  '/api/newsletter/draft': 'server/api/newsletter/draft.js',
  '/api/newsletter/approve': 'server/api/newsletter/approve.js',
  '/api/newsletter/shabbos': 'server/api/newsletter/shabbos.js',
  '/api/newsletter/zmanim/upload': 'server/api/newsletter/zmanim/upload.js',
  '/api/newsletter/zmanim/import': 'server/api/newsletter/zmanim/import.js',
  '/api/newsletter/zmanim/confirm': 'server/api/newsletter/zmanim/confirm.js',
  '/api/newsletter/zmanim/source': 'server/api/newsletter/zmanim/source.js',
}

function response(raw) {
  raw.status = function (code) { this.statusCode = code; return this }
  raw.json = function (value) { this.setHeader('Content-Type', 'application/json; charset=utf-8'); this.end(JSON.stringify(value)); return this }
  raw.send = function (value) { this.end(value); return this }
  raw.redirect = function (code, location) { this.statusCode = code; this.setHeader('Location', location); this.end(); return this }
  return raw
}

export function newsletterApiDevPlugin() {
  return {
    name: 'newsletter-api-dev',
    configureServer(server) {
      process.env.ATC_LOCAL_DEV = '1'
      server.middlewares.use(async (rawReq, rawRes, next) => {
        const url = new URL(rawReq.url, 'http://localhost')
        const file = handlers[url.pathname]
        if (!file) return next()
        try {
          const chunks = []
          for await (const chunk of rawReq) chunks.push(chunk)
          const body = Buffer.concat(chunks).toString()
          const req = Object.assign(rawReq, { query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : {} })
          const { default: handler } = await import(pathToFileURL(resolve(process.cwd(), file)).href)
          await handler(req, response(rawRes))
        } catch (error) {
          console.error('Local newsletter API failed', error)
          if (!rawRes.headersSent) { rawRes.statusCode = 500; rawRes.setHeader('Content-Type', 'application/json') }
          if (!rawRes.writableEnded) rawRes.end(JSON.stringify({ error: 'Local newsletter API failed.' }))
        }
      })
    },
  }
}

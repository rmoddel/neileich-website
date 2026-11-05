import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import process from 'node:process'

const handlers = {
  '/api/around-the-commons/auth/login': 'api/around-the-commons/auth/login.js',
  '/api/around-the-commons/auth/logout': 'api/around-the-commons/auth/logout.js',
  '/api/around-the-commons/ingest': 'api/around-the-commons/ingest.js',
  '/api/newsletter/session': 'api/newsletter/session.js',
  '/api/newsletter/issue': 'api/newsletter/issue.js',
  '/api/newsletter/draft': 'api/newsletter/draft.js',
  '/api/newsletter/approve': 'api/newsletter/approve.js',
  '/api/newsletter/shabbos': 'api/newsletter/shabbos.js',
}

function response(raw) {
  return {
    status(code) { raw.statusCode = code; return this },
    setHeader(name, value) { raw.setHeader(name, value); return this },
    json(value) { raw.setHeader('Content-Type', 'application/json; charset=utf-8'); raw.end(JSON.stringify(value)); return this },
    send(value) { raw.end(value); return this },
    redirect(code, location) { raw.statusCode = code; raw.setHeader('Location', location); raw.end(); return this },
    end() { raw.end(); return this },
  }
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

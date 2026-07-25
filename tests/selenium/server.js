const http = require("http");
const fs = require("fs");
const path = require("path");

function startMockServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      
      if (req.url === "/login" || req.url === "/") {
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Jutsu Classroom - Login</title></head>
            <body style="background:#0a0a0a; color:white;">
              <h1>Jutsu Classroom</h1>
              <p>Ingresá a la plataforma central</p>
              <form>
                <input id="email" type="email" placeholder="alumno@unrn.edu.ar" />
                <input id="password" type="password" />
                <button type="submit">Iniciar Sesión</button>
              </form>
              <button onclick="document.querySelector('p').innerText='Creá tu cuenta académica'">Registrate gratis</button>
              <button onclick="document.querySelector('p').innerText='Ingresá a la plataforma central'">Iniciá sesión</button>
              <button><span>Google</span></button>
              <button><span>GitHub</span></button>
            </body>
          </html>
        `);
      } else {
        res.writeHead(200);
        res.end(`<html><body><h1>Jutsu Classroom Dashboard</h1></body></html>`);
      }
    });

    server.listen(port, () => {
      resolve(server);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        // Port in use (server already running, e.g. next dev)
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { startMockServer };

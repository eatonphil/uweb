const fs = require('fs');
const net = require('net');

const CRLF = '\r\n';

const HELLO_WORLD = `<html>
  <body>
    <h1>Hello world!</h1>
  </body>
</html>`;
const NOT_FOUND = `<html>
  <body>
    <h1>Not found</h1>
  </body>
</html>`;

class HTTPRequestHandler {
  constructor(connection) {
    this.connection = connection;
    this.request = {
      statusLine: null,
      headers: {},
      body: null,
    };
  }

  parse(buffer) {
    const lines = buffer.toString().split(CRLF);

    // Parse/store status line if necessary
    if (!this.request.statusLine) {
      const [method, path, protocol] = lines.shift().split(' ');
      this.request.statusLine = { method, path, protocol };
    }

    // Parse/store headers if the body hasn't begun
    if (!this.request.body) {
      for (let line = lines.shift(); lines.length; line = lines.shift()) {
        // Reached the end of headers, double CRLF
        if (line === '') {
          this.request.body = '';
          break;
        }

        const [key, value] = line.split(':');

        const safeKey = key.toLowerCase();
        if (!this.request.headers[safeKey]) {
          this.request.headers[safeKey] = [];
        }

        this.request.headers[safeKey].push(value.trimStart());
      }
    }

    this.request.body += lines.join(CRLF);
  }
  
  requestComplete() {
    if (!this.request.statusLine || !Object.keys(this.request.headers).length || this.request.body === null) {
      return false;
    }

    const [contentLength] = this.request.headers['content-length'] || [];
    if (this.request.statusLine.method !== 'GET' && this.request.body.length !== contentLength) {
      return false;
    }
    
    return true;
  }
  
  sendResponse() {
    const response = { status: 200, statusMessage: 'OK', body: '' };

    if (this.request.statusLine.path === '/hello-world.html') {
      response.body = HELLO_WORLD;
    } else {
      response.status = 404;
      response.statusMessage = 'NOT FOUND';
      response.body = NOT_FOUND;
    }

    const serialized = 'HTTP/1.1 ${response.status} ${response.statusMessage}' + CRLF +
                       'Content-Length: ' + ${response.body.length} + CRLF + CRLF +
                       body;
    this.connection.write(serialized);
  }

  handle(buffer) {
    this.parse(buffer);

    if (!this.requestComplete()) {
      return;
    }
    
    this.sendResponse();

    // Other-wise the connection may attempt to be re-used, we don't support this.
    this.connection.end();
  }
}

function handleConnection(connection) {
  const handler = new HTTPRequestHandler(connection);
  connection.on('data', (buffer) => handler.handle(buffer));
}

const server = net.createServer(handleConnection);

server.listen('9000');

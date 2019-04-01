const stream = require('stream');
const url = require('url');

module.exports = class GenericParser extends stream.Duplex {

    constructor(httpLib, hlsstream, options) {
        super();
        this.hlsstream = hlsstream
        this.httpLib = httpLib;
        this.options = options;
        this.path = options.path;

        this.sources = 0, this.completed = 0, this.currentSources;
        this.lastFetched = Date.now();
        this.sequence = 0;
        this.totalsize = 0;
        this.chunks = {};
        this.downloading = false;
        this.live = true;
        this.refreshAttempts = 0, this.playlistRefresh = null;

        this.on('error', (err) => {
            hlsstream.emit('error', err);
        });
        this.on('end', () => {
            this.hlsstream.end();
        });
    }


    _read() {}
    _write() {}


    _download(link, index) {
        this.downloading = true, this.refreshAttempts = 0;
        this.hlsstream.emit('status', `Downloading segment ${index}`);

        let req = this.httpLib.get(link, (res) => {
            let timeout = setTimeout(() => {
                req.abort();
                this.completed--;
                this.hlsstream.emit('issue', `02: Failed to retrieve segment on time. Attempting to fetch segment again. [${index}]`);
                this._download(url.resolve(this.path, link), index);
            }, this.options.timeout);
            if(res.statusCode >= 400 || res.statusCode < 200) {
                this.hlsstream.emit('issue', `01B: An error occurred when attempting to retrieve a segment file. Attempting to fetch segment again. [${index}]`);
                this._download(url.resolve(this.path, link), index);
            }

            let body = [];
            res.on('data', (chunk) => {
                this.totalsize += chunk.length;
                body.push(chunk);
            });
            res.on('error', (err) => {
                this.hlsstream.emit('issue', `01C: An error occurred when attempting to retrieve a segment file. Attempting to fetch segment again. [${index}]`);
                this._download(url.resolve(this.path, link), index);
            });
            res.on('end', () => {
                if(!req.aborted) {
                    clearTimeout(timeout);
                    this.completed++;
                    this.hlsstream.emit('status', 'Completed download of segment ' + index);
                    this.chunks[index] = { link: url.resolve(this.path, link), buffer: Buffer.concat(body) };
                    if(this.completed === this.currentSources) this._save();
                }
            });
        });

        req.on('error', (err) => {
            this.hlsstream.emit('issue', `01A: An error occurred when attempting to retrieve a segment file. Attempting to fetch segment again. [${index}]`);
            this._download(url.resolve(this.path, link), index);
        });
    }


    _save() {
        this.hlsstream.emit('status', 'Pushing segments to stream');

        let index = Object.values(this.chunks).length - this.currentSources;
        let length = Object.values(this.chunks).length;

        try {
            for (index; index < length; index++) {
                const bufferStream = new stream.PassThrough();
                bufferStream.write(this.chunks[index].buffer);
                bufferStream.pipe(this.hlsstream, { end: false });
                bufferStream.end();
                this.hlsstream.emit('segment', {
                    id: index,
                    url: url.resolve(this.path, this.chunks[index].link),
                    size: this.chunks[index].buffer.length,
                    totalsegments: this.sources - 1
                });
                delete this.chunks[index].buffer;

                if (index == this.sources - 1 && this.live == false) {
                    this.hlsstream.emit('status', 'Finished pushing segments to stream');
                    this.downloading = false;
                    this.hlsstream.emit('end');
                }
            }
        } catch(e) {
            this.hlsstream.emit('issue', 'A critical error occurred when writing to stream' + e);
        }
    }


    _fetchPlaylist() {
        if (this.live == true) {
            if (this.refreshAttempts < 5) {
                const delta = Date.now() - this.lastFetched;

                this.lastFetched += this.options.livebuffer;
                clearTimeout(this.playlistRefresh);
                this.playlistRefresh = setTimeout(() => {
                    let req = this.httpLib.get(this.path, (res) => {
                        let responseBody = '';

                        let timeout = setTimeout(() => {
                            req.abort();
                            this.hlsstream.emit('issue', '05: Failed to retrieve playlist on time. Attempting to fetch playlist again.');
                            this.refreshAttempts++;
                            this._fetchPlaylist();
                        }, this.options.timeout);
                        res.on('error', (err) => {
                            this.hlsstream.emit('issue', '03A: An error occurred on the response when attempting to fetch the latest playlist: ' + err);
                            this.refreshAttempts++;
                            this._fetchPlaylist()
                        });

                        if (res.statusCode === 200) {
                            res.on('data', chunk => {
                                responseBody += chunk;
                            });
                            res.on('end', () => {
                                if(!req.aborted && this.refreshAttempts < 5) {
                                    clearTimeout(timeout);
                                    this._write(responseBody);
                                }
                            });
                        } else {
                            this.hlsstream.emit('issue', '04: Fetching playlist returned an HTTP code other than 200: ' + res.statusCode + '. Trying again...');
                            this._fetchPlaylist();
                        }
                    });
                    req.on('error', (err) => {
                        this.hlsstream.emit('issue', '03B: An error occurred on the request when attempting to fetch the latest playlist: ' + err);
                        this.refreshAttempts++;
                        this._fetchPlaylist();
                    });
                }, Math.max(0, this.options.livebuffer - delta));
            } else {
                clearTimeout(this.playlistRefresh);
                this.hlsstream.emit('status', 'Live stream completed');
                this.hlsstream.emit('end');
            }
        } else {
            this.hlsstream.emit('issue', 'Stream is not a live stream');
            this.hlsstream.emit('end');
        }
    }
};
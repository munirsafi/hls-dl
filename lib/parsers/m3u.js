const stream = require('stream');
const url = require('url');

module.exports = class m3u extends stream.Duplex {

    constructor(httpLib, hlsstream, options) {
        super();
        this.hlsstream = hlsstream
        this.httpLib = httpLib;
        this.options = options;
        this.path = options.path;
        
        this.sources = 0, this.completed = 0, this.currentSources;
        this.sequence = 0;
        this.totalsize = 0;
        this.chunks = {};
        this.downloading = false;
        this.live = true;
        this.refreshAttempts = 0;

        this.pipe(hlsstream, { end: false });
        this.on('end', () => {
            this.hlsstream.end();
        });
    }

    _read() {}
    _write(chunk) {
        this.currentSources = 0, this.completed = 0;
        const playlist = chunk.toString().trim().split('\n');
        let hasNoNewSegments = true;
        this.hlsstream.emit('status', 'Parsing through playlist');
        for(let index = 0; index < playlist.length; index++) {
            if(this._parse(playlist[index]) == false) break;
            if(playlist[index][0] !== '#') {
                if(Object.values(this.chunks).every(segment => segment.link == url.resolve(this.path, playlist[index])) == true) {
                    hasNoNewSegments = false;
                }
            }
        }
        if(hasNoNewSegments == true || this.live == true) {
            this.refreshAttempts++;
            this._fetchPlaylist();
        } else {
            this.refreshAttempts = 0;
        }
        this.hlsstream.emit('status', 'Playlist parsing complete');
    }

    _parse(line) {
        let value = line;
        let info = null;

        if(line[0] == '#' && line.indexOf(':') != -1) {
            value = line.split(':')[0];
            info = line.split(':')[1];
        }

        switch(value) {
            case('#EXT-X-MEDIA-SEQUENCE'):
                if(info < this.sequence) return false;
                this.sequence = info;
                break;
            case('#EXTINF'):
                this.duration += parseFloat(info.split(',')[0]);
                break;
            case('#EXT-X-ENDLIST'):
                this.live = false;
                break;
            default:
                if(value[0] != '#') {
                    if(!Object.values(this.chunks).some(x => x.link == url.resolve(this.path, value))) {
                        this.currentSources++;
                        this._download(url.resolve(this.path, value), this.sources++);
                    }
                }
                break;
        }
    }

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
                clearTimeout(timeout);
                this.completed++;
                this.hlsstream.emit('status', 'Completed download of segment ' + index);
                this.chunks[index] = { link: url.resolve(this.path, link), buffer: Buffer.concat(body) };
                if(this.completed === this.currentSources) this._save();
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
        for(index; index < length; index++) {
            this.push(this.chunks[index].buffer);
            this.hlsstream.emit('segment', {
                id: index,
                url: url.resolve(this.path, this.chunks[index].link),
                size: this.chunks[index].buffer.length,
                totalsegments: this.sources -1
            });

            if(index == this.sources - 1 && this.live == false) {
                this.hlsstream.emit('status', 'Finished pushing segments to stream');
                this.downloading = false;
                this.push(null);
            }
        }
    }

    _fetchPlaylist() {
        if (this.live == true) {
            console.log('Refresh Attempts: ' + this.refreshAttempts);
            if (this.refreshAttempts < 5) {
                setTimeout(() => {
                    this.httpLib.get(this.path, (res) => {
                        let responseBody = '',
                            downloadedContent = 0;

                        res.on('error', (err) => {
                            this.refreshAttempts++;
                            this._fetchPlaylist()
                        });

                        if (res.statusCode === 200) {
                            res.on('data', chunk => {
                                downloadedContent += chunk.length;
                                responseBody += chunk;
                            });
                            res.on('end', () => {
                                if (res.headers['content-length'] == downloadedContent) {
                                    this._write(responseBody);
                                }
                            });
                        }
                    }).on('error', (err) => {
                        this.refreshAttempts++;
                        this._fetchPlaylist();
                    });
                }, this.options.livebuffer);
            } else {
                this.hlsstream.emit('status', 'Live stream completed');
                this.push(null);
            }
        }
    }

};
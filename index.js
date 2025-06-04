const NodeMediaServer = require('node-media-server');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  
  http: {
    port: 3001,
    allow_origin: '*',
    mediaroot: './',
    api: true,
    flv: true, 
  },
  api: {
    port: 3001,
    allow_origin: '*'
  },
  trans: {
    ffmpeg: '/usr/local/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        ac: 'aac',
        acParam: [
          '-b:a', '320k',
          '-acodec', 'aac',
          '-ar', '48000',
          '-af', 'aresample=async=1000',
          '-profile:a', 'aac_low',
          '-q:a', '0'
        ],
        vcParam: [],
        preset: 'audio',
        audioBitrate: 320,
        audioChannels: 2,
        audioSampleRate: 48000
      }
    ]
  }
};

const nms = new NodeMediaServer(config);
nms.run();

// Store active streams
const activeStreams = new Map();

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Validate stream path format (e.g., /live/station1, /live/station2)
  const pathParts = StreamPath.split('/');
  if (pathParts.length !== 3 || pathParts[1] !== 'live') {
    let session = nms.getSession(id);
    session.reject();
    return;
  }

  // Add stream to active streams
  activeStreams.set(StreamPath, {
    id: id,
    startTime: new Date(),
    metadata: args,
    type: 'audio'
  });
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // Remove stream from active streams
  activeStreams.delete(StreamPath);
});

// Helper function to get active stations
function getActiveStations() {
  return Array.from(activeStreams.keys()).map(streamPath => {
    const station = streamPath.split('/')[2];
    const stream = activeStreams.get(streamPath);
    return {
      station,
      uptime: new Date() - stream.startTime,
      streamPath,
      type: 'audio',
      format: {
        codec: 'aac',
        bitrate: '128k',
        sampleRate: '44.1kHz',
        channels: 2
      }
    };
  });
}
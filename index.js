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
    mediaroot: './media',
  },
  trans: {
    ffmpeg: '/usr/local/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        ac: 'aac', // Using AAC codec for better quality
        acParam: [
          '-b:a', '320k',      // Increased bitrate to 320kbps for high quality
          '-acodec', 'aac',    // Explicitly set AAC codec
          '-ar', '48000',      // Increased sample rate to 48kHz
          '-af', 'aresample=async=1000', // Helps prevent audio drift
          '-profile:a', 'aac_low', // AAC-LC profile for better compatibility
          '-q:a', '0'          // Highest quality setting
        ],
        vcParam: [], // Empty video params since we're doing audio only
        preset: 'audio',
        audioBitrate: 320,     // Matching the higher bitrate
        audioChannels: 2,      // Stereo audio
        audioSampleRate: 48000 // Higher sample rate for better quality
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
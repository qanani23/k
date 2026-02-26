use crate::encryption::EncryptionManager;
use crate::error::{KiyyaError, Result};
use crate::models::ServerStatus;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::sync::{Mutex, RwLock};
use tracing::{error, info, warn};
use warp::{http::StatusCode, Filter, Rejection, Reply};

pub struct LocalServer {
    port: Option<u16>,
    active_streams: Arc<RwLock<HashMap<String, StreamInfo>>>,
    encryption_manager: Arc<Mutex<EncryptionManager>>,
    server_handle: Option<tokio::task::JoinHandle<()>>,
}

#[derive(Debug, Clone)]
struct StreamInfo {
    file_path: PathBuf,
    encrypted: bool,
    content_type: String,
    file_size: u64,
}

impl LocalServer {
    pub async fn new() -> Result<Self> {
        let encryption_manager = EncryptionManager::new()?;

        Ok(Self {
            port: None,
            active_streams: Arc::new(RwLock::new(HashMap::new())),
            encryption_manager: Arc::new(Mutex::new(encryption_manager)),
            server_handle: None,
        })
    }

    pub async fn start(&mut self) -> Result<u16> {
        if let Some(port) = self.port {
            return Ok(port);
        }

        // Bind to random available port
        let addr: SocketAddr = "127.0.0.1:0"
            .parse()
            .expect("Hardcoded localhost address should always parse successfully");
        let listener = tokio::net::TcpListener::bind(addr).await?;
        let local_addr = listener.local_addr()?;
        let port = local_addr.port();

        info!("Starting local HTTP server on port {}", port);

        let active_streams = self.active_streams.clone();
        let encryption_manager = self.encryption_manager.clone();

        // Create warp routes
        let movies_route = warp::path!("movies" / String)
            .and(warp::header::optional::<String>("range"))
            .and_then(move |uuid: String, range: Option<String>| {
                let active_streams = active_streams.clone();
                let encryption_manager = encryption_manager.clone();

                async move { serve_content(uuid, range, active_streams, encryption_manager).await }
            });

        // Health check endpoint
        let active_streams_health = self.active_streams.clone();
        let health_route = warp::path!("health").and(warp::get()).and_then(move || {
            let active_streams = active_streams_health.clone();
            async move { health_check(active_streams).await }
        });

        // Status endpoint with detailed information
        let active_streams_status = self.active_streams.clone();
        let status_route = warp::path!("status").and(warp::get()).and_then(move || {
            let active_streams = active_streams_status.clone();
            async move { status_check(active_streams).await }
        });

        let routes = movies_route.or(health_route).or(status_route).with(
            warp::cors()
                .allow_any_origin()
                .allow_headers(vec!["range"])
                .allow_methods(vec!["GET", "HEAD", "OPTIONS"]),
        );

        // Start server
        let server = warp::serve(routes);
        let server_handle = tokio::spawn(async move {
            server
                .serve_incoming(tokio_stream::wrappers::TcpListenerStream::new(listener))
                .await;
        });

        self.port = Some(port);
        self.server_handle = Some(server_handle);

        info!("Local HTTP server started successfully on port {}", port);
        Ok(port)
    }

    pub async fn register_content(
        &self,
        uuid: &str,
        file_path: PathBuf,
        encrypted: bool,
    ) -> Result<()> {
        let file_size = tokio::fs::metadata(&file_path).await?.len();
        let content_type = mime_guess::from_path(&file_path)
            .first_or_octet_stream()
            .to_string();

        let stream_info = StreamInfo {
            file_path,
            encrypted,
            content_type,
            file_size,
        };

        let mut streams = self.active_streams.write().await;
        streams.insert(uuid.to_string(), stream_info);

        info!(
            "Registered content for streaming: {} (encrypted: {})",
            uuid, encrypted
        );
        Ok(())
    }

    pub async fn unregister_content(&self, uuid: &str) -> Result<()> {
        let mut streams = self.active_streams.write().await;
        streams.remove(uuid);
        info!("Unregistered content: {}", uuid);
        Ok(())
    }

    pub async fn get_status(&self) -> ServerStatus {
        let active_streams = self.active_streams.read().await;

        ServerStatus {
            running: self.port.is_some(),
            port: self.port,
            active_streams: active_streams.len() as u32,
        }
    }

    pub async fn stop(&mut self) -> Result<()> {
        if let Some(handle) = self.server_handle.take() {
            handle.abort();
            info!("Local HTTP server stopped");
        }

        self.port = None;
        Ok(())
    }
}

async fn serve_content(
    uuid: String,
    range_header: Option<String>,
    active_streams: Arc<RwLock<HashMap<String, StreamInfo>>>,
    encryption_manager: Arc<Mutex<EncryptionManager>>,
) -> std::result::Result<impl Reply, Rejection> {
    let streams = active_streams.read().await;
    let stream_info = match streams.get(&uuid) {
        Some(info) => info.clone(),
        None => {
            warn!("Content not found: {}", uuid);
            return Ok(
                warp::reply::with_status("Content not found", StatusCode::NOT_FOUND)
                    .into_response(),
            );
        }
    };
    drop(streams);

    // Parse range header
    let (start, end) = if let Some(range) = range_header {
        match parse_range_header(&range, stream_info.file_size) {
            Ok(range) => range,
            Err(e) => {
                warn!("Invalid range header: {} - {}", range, e);
                return Ok(warp::reply::with_status(
                    "Range Not Satisfiable",
                    StatusCode::RANGE_NOT_SATISFIABLE,
                )
                .into_response());
            }
        }
    } else {
        (0, stream_info.file_size - 1)
    };

    // Read content
    let content = if stream_info.encrypted {
        // Decrypt range
        let encryption_manager = encryption_manager.lock().await;
        match encryption_manager
            .decrypt_range(&stream_info.file_path, start, end)
            .await
        {
            Ok(data) => data,
            Err(e) => {
                error!("Failed to decrypt content: {}", e);
                return Ok(warp::reply::with_status(
                    "Internal Server Error",
                    StatusCode::INTERNAL_SERVER_ERROR,
                )
                .into_response());
            }
        }
    } else {
        // Read plain file range
        match read_file_range(&stream_info.file_path, start, end).await {
            Ok(data) => data,
            Err(e) => {
                error!("Failed to read file: {}", e);
                return Ok(warp::reply::with_status(
                    "Internal Server Error",
                    StatusCode::INTERNAL_SERVER_ERROR,
                )
                .into_response());
            }
        }
    };

    // Build response
    let content_length = content.len();
    let is_partial = start > 0 || end < stream_info.file_size - 1;

    let mut response = warp::http::Response::builder()
        .header("Content-Type", &stream_info.content_type)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", content_length.to_string())
        .header("Cache-Control", "no-cache");

    if is_partial {
        response = response.status(StatusCode::PARTIAL_CONTENT).header(
            "Content-Range",
            format!("bytes {}-{}/{}", start, end, stream_info.file_size),
        );
    } else {
        response = response.status(StatusCode::OK);
    }

    match response.body(content) {
        Ok(resp) => Ok(resp.into_response()),
        Err(e) => {
            error!("Failed to build response: {}", e);
            Ok(
                warp::reply::with_status(
                    "Internal Server Error",
                    StatusCode::INTERNAL_SERVER_ERROR,
                )
                .into_response(),
            )
        }
    }
}

/// Health check endpoint - returns 200 OK if server is running
async fn health_check(
    _active_streams: Arc<RwLock<HashMap<String, StreamInfo>>>,
) -> std::result::Result<impl Reply, Rejection> {
    Ok(warp::reply::with_status(
        warp::reply::json(&serde_json::json!({
            "status": "ok",
            "service": "kiyya-local-server"
        })),
        StatusCode::OK,
    ))
}

/// Status endpoint - returns detailed server status
async fn status_check(
    active_streams: Arc<RwLock<HashMap<String, StreamInfo>>>,
) -> std::result::Result<impl Reply, Rejection> {
    let streams = active_streams.read().await;
    let active_count = streams.len();

    // Calculate total size of registered content
    let total_size: u64 = streams.values().map(|s| s.file_size).sum();

    // Count encrypted vs unencrypted streams
    let encrypted_count = streams.values().filter(|s| s.encrypted).count();
    let unencrypted_count = active_count - encrypted_count;

    Ok(warp::reply::with_status(
        warp::reply::json(&serde_json::json!({
            "status": "ok",
            "service": "kiyya-local-server",
            "active_streams": active_count,
            "encrypted_streams": encrypted_count,
            "unencrypted_streams": unencrypted_count,
            "total_content_size_bytes": total_size,
            "uptime_info": "Server is running"
        })),
        StatusCode::OK,
    ))
}

fn parse_range_header(range: &str, file_size: u64) -> Result<(u64, u64)> {
    if !range.starts_with("bytes=") {
        return Err(KiyyaError::InvalidRange {
            range: range.to_string(),
        });
    }

    let range_spec = &range[6..]; // Remove "bytes="
    let parts: Vec<&str> = range_spec.split('-').collect();

    if parts.len() != 2 {
        return Err(KiyyaError::InvalidRange {
            range: range.to_string(),
        });
    }

    // Handle suffix range: -500 means last 500 bytes
    if parts[0].is_empty() {
        if let Ok(suffix) = parts[1].parse::<u64>() {
            let start = if suffix >= file_size {
                0
            } else {
                file_size - suffix
            };
            let end = file_size - 1;
            return Ok((start, end));
        } else {
            return Err(KiyyaError::InvalidRange {
                range: range.to_string(),
            });
        }
    }

    // Parse start position
    let start = parts[0]
        .parse::<u64>()
        .map_err(|_| KiyyaError::InvalidRange {
            range: range.to_string(),
        })?;

    // Parse end position
    let end = if parts[1].is_empty() {
        file_size - 1
    } else {
        let parsed_end = parts[1]
            .parse::<u64>()
            .map_err(|_| KiyyaError::InvalidRange {
                range: range.to_string(),
            })?;
        std::cmp::min(parsed_end, file_size - 1)
    };

    if start > end || start >= file_size {
        return Err(KiyyaError::InvalidRange {
            range: range.to_string(),
        });
    }

    Ok((start, end))
}

async fn read_file_range(file_path: &PathBuf, start: u64, end: u64) -> Result<Vec<u8>> {
    let mut file = File::open(file_path).await?;
    file.seek(SeekFrom::Start(start)).await?;

    let length = (end - start + 1) as usize;
    let mut buffer = vec![0u8; length];

    let bytes_read = file.read(&mut buffer).await?;
    buffer.truncate(bytes_read);

    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::fs::write;

    #[test]
    fn test_parse_range_header_full_range() {
        let result = parse_range_header("bytes=0-1023", 2048);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 0);
        assert_eq!(end, 1023);
    }

    #[test]
    fn test_parse_range_header_open_end() {
        let result = parse_range_header("bytes=1024-", 2048);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 1024);
        assert_eq!(end, 2047); // file_size - 1
    }

    #[test]
    fn test_parse_range_header_suffix() {
        let result = parse_range_header("bytes=-500", 2048);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 1548); // 2048 - 500
        assert_eq!(end, 2047);
    }

    #[test]
    fn test_parse_range_header_invalid_format() {
        let result = parse_range_header("invalid", 2048);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_range_header_invalid_range() {
        // Start beyond file size
        let result = parse_range_header("bytes=3000-", 2048);
        assert!(result.is_err());

        // Start > end
        let result = parse_range_header("bytes=1000-500", 2048);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_range_header_end_beyond_file_size() {
        let result = parse_range_header("bytes=0-5000", 2048);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 0);
        assert_eq!(end, 2047); // Clamped to file_size - 1
    }

    #[tokio::test]
    async fn test_read_file_range() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        // Create test file with known content
        let content = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        write(&file_path, content).await.unwrap();

        // Read first 10 bytes
        let result = read_file_range(&file_path, 0, 9).await;
        assert!(result.is_ok());
        let data = result.unwrap();
        assert_eq!(data, b"0123456789");

        // Read middle section
        let result = read_file_range(&file_path, 10, 19).await;
        assert!(result.is_ok());
        let data = result.unwrap();
        assert_eq!(data, b"ABCDEFGHIJ");

        // Read last bytes
        let result = read_file_range(&file_path, 26, 35).await;
        assert!(result.is_ok());
        let data = result.unwrap();
        assert_eq!(data, b"QRSTUVWXYZ");
    }

    #[tokio::test]
    async fn test_read_file_range_single_byte() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        let content = b"ABCDEFGHIJ";
        write(&file_path, content).await.unwrap();

        // Read single byte
        let result = read_file_range(&file_path, 5, 5).await;
        assert!(result.is_ok());
        let data = result.unwrap();
        assert_eq!(data, b"F");
    }

    #[tokio::test]
    async fn test_read_file_range_entire_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        let content = b"Hello, World!";
        write(&file_path, content).await.unwrap();

        // Read entire file
        let result = read_file_range(&file_path, 0, 12).await;
        assert!(result.is_ok());
        let data = result.unwrap();
        assert_eq!(data, content);
    }

    #[tokio::test]
    async fn test_read_file_range_nonexistent_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("nonexistent.txt");

        let result = read_file_range(&file_path, 0, 10).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_local_server_creation() {
        let result = LocalServer::new().await;
        assert!(result.is_ok());

        let server = result.unwrap();
        assert!(server.port.is_none()); // Server not started yet
    }

    #[tokio::test]
    async fn test_local_server_start() {
        let mut server = LocalServer::new().await.unwrap();

        let result = server.start().await;
        assert!(result.is_ok());

        let port = result.unwrap();
        assert!(port > 0);
        assert_eq!(server.port, Some(port));

        // Starting again should return the same port
        let result2 = server.start().await;
        assert!(result2.is_ok());
        assert_eq!(result2.unwrap(), port);
    }

    #[tokio::test]
    async fn test_local_server_register_content() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.mp4");
        write(&file_path, b"test video content").await.unwrap();

        let server = LocalServer::new().await.unwrap();

        let result = server
            .register_content("test-uuid", file_path.clone(), false)
            .await;
        assert!(result.is_ok());

        // Verify content is registered
        let streams = server.active_streams.read().await;
        assert!(streams.contains_key("test-uuid"));
        let stream_info = streams.get("test-uuid").unwrap();
        assert_eq!(stream_info.file_path, file_path);
        assert!(!stream_info.encrypted);
    }

    #[tokio::test]
    async fn test_local_server_unregister_content() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.mp4");
        write(&file_path, b"test video content").await.unwrap();

        let server = LocalServer::new().await.unwrap();

        // Register content
        server
            .register_content("test-uuid", file_path, false)
            .await
            .unwrap();

        // Verify it's registered
        {
            let streams = server.active_streams.read().await;
            assert!(streams.contains_key("test-uuid"));
        }

        // Unregister content
        let result = server.unregister_content("test-uuid").await;
        assert!(result.is_ok());

        // Verify it's unregistered
        let streams = server.active_streams.read().await;
        assert!(!streams.contains_key("test-uuid"));
    }

    #[tokio::test]
    async fn test_local_server_get_status() {
        let mut server = LocalServer::new().await.unwrap();

        // Status before starting
        let status = server.get_status().await;
        assert!(!status.running);
        assert_eq!(status.port, None);
        assert_eq!(status.active_streams, 0);

        // Start server
        server.start().await.unwrap();

        // Status after starting
        let status = server.get_status().await;
        assert!(status.running);
        assert!(status.port.is_some());
        assert_eq!(status.active_streams, 0);

        // Register some content
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.mp4");
        write(&file_path, b"test").await.unwrap();
        server
            .register_content("uuid1", file_path.clone(), false)
            .await
            .unwrap();
        server
            .register_content("uuid2", file_path, false)
            .await
            .unwrap();

        // Status with active streams
        let status = server.get_status().await;
        assert_eq!(status.active_streams, 2);
    }

    #[tokio::test]
    async fn test_local_server_stop() {
        let mut server = LocalServer::new().await.unwrap();

        // Start server
        server.start().await.unwrap();
        assert!(server.port.is_some());

        // Stop server
        let result = server.stop().await;
        assert!(result.is_ok());
        assert!(server.port.is_none());
    }

    #[test]
    fn test_range_request_scenarios() {
        // Test various range request scenarios that browsers might send

        // Chrome-style range request
        let result = parse_range_header("bytes=0-", 1000000);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 0);
        assert_eq!(end, 999999);

        // Seeking to middle
        let result = parse_range_header("bytes=500000-", 1000000);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 500000);
        assert_eq!(end, 999999);

        // Small chunk request
        let result = parse_range_header("bytes=0-1023", 1000000);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 0);
        assert_eq!(end, 1023);

        // Last 1KB
        let result = parse_range_header("bytes=-1024", 1000000);
        assert!(result.is_ok());
        let (start, end) = result.unwrap();
        assert_eq!(start, 998976); // 1000000 - 1024
        assert_eq!(end, 999999);
    }

    #[tokio::test]
    async fn test_concurrent_streaming_connections() {
        use tokio::time::{sleep, Duration};

        // Create test file
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_video.mp4");

        // Create a larger test file to simulate real video content
        let content: Vec<u8> = (0..10000).map(|i| (i % 256) as u8).collect();
        write(&file_path, &content).await.unwrap();

        // Create and start server
        let mut server = LocalServer::new().await.unwrap();
        let port = server.start().await.unwrap();

        // Register content
        server
            .register_content("test-video", file_path.clone(), false)
            .await
            .unwrap();

        // Simulate multiple concurrent clients requesting different ranges
        let client = reqwest::Client::new();
        let base_url = format!("http://127.0.0.1:{}/movies/test-video", port);

        // Create multiple concurrent requests
        let mut handles = vec![];

        // Client 1: Request first 1000 bytes
        let url1 = base_url.clone();
        let client1 = client.clone();
        let handle1 = tokio::spawn(async move {
            let response = client1
                .get(&url1)
                .header("Range", "bytes=0-999")
                .send()
                .await
                .unwrap();

            assert_eq!(response.status(), 206); // Partial Content
            let body = response.bytes().await.unwrap();
            assert_eq!(body.len(), 1000);
            body
        });
        handles.push(handle1);

        // Client 2: Request middle 1000 bytes (concurrent with client 1)
        let url2 = base_url.clone();
        let client2 = client.clone();
        let handle2 = tokio::spawn(async move {
            let response = client2
                .get(&url2)
                .header("Range", "bytes=5000-5999")
                .send()
                .await
                .unwrap();

            assert_eq!(response.status(), 206);
            let body = response.bytes().await.unwrap();
            assert_eq!(body.len(), 1000);
            body
        });
        handles.push(handle2);

        // Client 3: Request last 1000 bytes (concurrent with clients 1 and 2)
        let url3 = base_url.clone();
        let client3 = client.clone();
        let handle3 = tokio::spawn(async move {
            let response = client3
                .get(&url3)
                .header("Range", "bytes=9000-9999")
                .send()
                .await
                .unwrap();

            assert_eq!(response.status(), 206);
            let body = response.bytes().await.unwrap();
            assert_eq!(body.len(), 1000);
            body
        });
        handles.push(handle3);

        // Client 4: Request entire file (concurrent with others)
        let url4 = base_url.clone();
        let client4 = client.clone();
        let handle4 = tokio::spawn(async move {
            let response = client4.get(&url4).send().await.unwrap();

            assert_eq!(response.status(), 200); // Full content
            let body = response.bytes().await.unwrap();
            assert_eq!(body.len(), 10000);
            body
        });
        handles.push(handle4);

        // Wait for all requests to complete
        let results = futures::future::join_all(handles).await;

        // Verify all requests succeeded
        for result in results {
            assert!(result.is_ok());
        }

        // Verify server status shows correct active streams count
        let status = server.get_status().await;
        assert_eq!(status.active_streams, 1); // One registered content

        // Clean up
        server.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_concurrent_streaming_same_range() {
        // Test multiple clients requesting the exact same range simultaneously
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_video.mp4");

        let content: Vec<u8> = (0..5000).map(|i| (i % 256) as u8).collect();
        write(&file_path, &content).await.unwrap();

        let mut server = LocalServer::new().await.unwrap();
        let port = server.start().await.unwrap();
        server
            .register_content("test-video", file_path.clone(), false)
            .await
            .unwrap();

        let client = reqwest::Client::new();
        let base_url = format!("http://127.0.0.1:{}/movies/test-video", port);

        // Create 5 concurrent requests for the same range
        let mut handles = vec![];
        for _ in 0..5 {
            let url = base_url.clone();
            let client_clone = client.clone();
            let handle = tokio::spawn(async move {
                let response = client_clone
                    .get(&url)
                    .header("Range", "bytes=1000-1999")
                    .send()
                    .await
                    .unwrap();

                assert_eq!(response.status(), 206);
                let body = response.bytes().await.unwrap();
                assert_eq!(body.len(), 1000);

                // Verify content matches expected range
                let expected: Vec<u8> = (1000..2000).map(|i| (i % 256) as u8).collect();
                assert_eq!(body.to_vec(), expected);

                body
            });
            handles.push(handle);
        }

        // Wait for all requests to complete
        let results = futures::future::join_all(handles).await;

        // Verify all 5 requests succeeded
        assert_eq!(results.len(), 5);
        for result in results {
            assert!(result.is_ok());
        }

        server.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_concurrent_streaming_with_seeks() {
        // Simulate video player seeking behavior with concurrent connections
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_video.mp4");

        let content: Vec<u8> = (0..20000).map(|i| (i % 256) as u8).collect();
        write(&file_path, &content).await.unwrap();

        let mut server = LocalServer::new().await.unwrap();
        let port = server.start().await.unwrap();
        server
            .register_content("test-video", file_path.clone(), false)
            .await
            .unwrap();

        let client = reqwest::Client::new();
        let base_url = format!("http://127.0.0.1:{}/movies/test-video", port);

        // Simulate a video player that:
        // 1. Starts playing from beginning
        // 2. User seeks to middle
        // 3. User seeks to near end
        // All happening in quick succession (concurrent requests)

        let mut handles = vec![];

        // Initial playback request
        let url1 = base_url.clone();
        let client1 = client.clone();
        let handle1 = tokio::spawn(async move {
            client1
                .get(&url1)
                .header("Range", "bytes=0-4999")
                .send()
                .await
                .unwrap()
                .status()
        });
        handles.push(handle1);

        // Seek to middle
        let url2 = base_url.clone();
        let client2 = client.clone();
        let handle2 = tokio::spawn(async move {
            client2
                .get(&url2)
                .header("Range", "bytes=10000-14999")
                .send()
                .await
                .unwrap()
                .status()
        });
        handles.push(handle2);

        // Seek to near end
        let url3 = base_url.clone();
        let client3 = client.clone();
        let handle3 = tokio::spawn(async move {
            client3
                .get(&url3)
                .header("Range", "bytes=15000-19999")
                .send()
                .await
                .unwrap()
                .status()
        });
        handles.push(handle3);

        // Wait for all requests
        let results = futures::future::join_all(handles).await;

        // All should return 206 Partial Content
        for result in results {
            let status = result.unwrap();
            assert_eq!(status, 206);
        }

        server.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_encrypted_file_streaming() {
        use crate::encryption::EncryptionManager;
        use tempfile::TempDir;
        use tokio::fs::write;

        let temp_dir = TempDir::new().unwrap();
        let plain_file = temp_dir.path().join("plain.mp4");
        let encrypted_file = temp_dir.path().join("encrypted.mp4");

        // Create test video content (10KB)
        let original_content: Vec<u8> = (0..10_000).map(|i| (i % 256) as u8).collect();
        write(&plain_file, &original_content).await.unwrap();

        // Encrypt the file
        let mut encryption_manager = EncryptionManager::new().unwrap();
        encryption_manager
            .enable_encryption("test_streaming_passphrase")
            .unwrap();
        encryption_manager
            .encrypt_file(&plain_file, &encrypted_file)
            .await
            .unwrap();

        // Get encrypted file size for registration
        let encrypted_file_size = tokio::fs::metadata(&encrypted_file).await.unwrap().len();

        // Start local server and enable encryption on its manager
        let mut server = LocalServer::new().await.unwrap();

        // Enable encryption on the server's encryption manager
        {
            let mut server_enc_mgr = server.encryption_manager.lock().await;
            server_enc_mgr
                .enable_encryption("test_streaming_passphrase")
                .unwrap();
        }

        let port = server.start().await.unwrap();

        // Register encrypted content
        server
            .register_content("test-encrypted-video", encrypted_file.clone(), true)
            .await
            .unwrap();

        // Test 1: Request full encrypted content
        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/movies/test-encrypted-video", port);

        let response = client.get(&url).send().await.unwrap();
        assert_eq!(response.status(), 200);

        let decrypted_content = response.bytes().await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content.to_vec(), original_content);

        // Test 2: Request range from encrypted content
        let response = client
            .get(&url)
            .header("Range", "bytes=1000-1999")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 206); // Partial Content

        let decrypted_range = response.bytes().await.unwrap();
        assert_eq!(decrypted_range.len(), 1000);
        assert_eq!(decrypted_range.to_vec(), original_content[1000..2000]);

        // Test 3: Request multiple ranges (simulating video seeking)
        let ranges = vec![(0, 999), (5000, 5999), (9000, 9999)];

        for (start, end) in ranges {
            let response = client
                .get(&url)
                .header("Range", format!("bytes={}-{}", start, end))
                .send()
                .await
                .unwrap();

            assert_eq!(response.status(), 206);

            let decrypted_range = response.bytes().await.unwrap();
            let expected_len = (end - start + 1) as usize;
            assert_eq!(decrypted_range.len(), expected_len);
            assert_eq!(
                decrypted_range.to_vec(),
                original_content[start as usize..(end + 1) as usize]
            );
        }

        // Clean up
        server
            .unregister_content("test-encrypted-video")
            .await
            .unwrap();
        server.stop().await.unwrap();
        encryption_manager.disable_encryption().unwrap();
    }

    #[tokio::test]
    async fn test_encrypted_large_file_streaming() {
        use crate::encryption::EncryptionManager;
        use tempfile::TempDir;
        use tokio::fs::write;

        let temp_dir = TempDir::new().unwrap();
        let plain_file = temp_dir.path().join("large_plain.mp4");
        let encrypted_file = temp_dir.path().join("large_encrypted.mp4");

        // Create larger test content (200KB - spans multiple encryption chunks)
        let original_content: Vec<u8> = (0..200_000).map(|i| (i % 256) as u8).collect();
        write(&plain_file, &original_content).await.unwrap();

        // Encrypt the file
        let mut encryption_manager = EncryptionManager::new().unwrap();
        encryption_manager
            .enable_encryption("test_large_streaming")
            .unwrap();
        encryption_manager
            .encrypt_file(&plain_file, &encrypted_file)
            .await
            .unwrap();

        // Start local server and enable encryption
        let mut server = LocalServer::new().await.unwrap();

        // Enable encryption on the server's encryption manager
        {
            let mut server_enc_mgr = server.encryption_manager.lock().await;
            server_enc_mgr
                .enable_encryption("test_large_streaming")
                .unwrap();
        }

        let port = server.start().await.unwrap();

        // Register encrypted content
        server
            .register_content("large-encrypted-video", encrypted_file.clone(), true)
            .await
            .unwrap();

        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/movies/large-encrypted-video", port);

        // Test range spanning multiple encryption chunks
        let response = client
            .get(&url)
            .header("Range", "bytes=60000-80000")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 206);

        let decrypted_range = response.bytes().await.unwrap();
        assert_eq!(decrypted_range.len(), 20001); // 80000 - 60000 + 1
        assert_eq!(decrypted_range.to_vec(), original_content[60000..80001]);

        // Clean up
        server
            .unregister_content("large-encrypted-video")
            .await
            .unwrap();
        server.stop().await.unwrap();
        encryption_manager.disable_encryption().unwrap();
    }

    #[tokio::test]
    async fn test_mixed_encrypted_and_plain_streaming() {
        use crate::encryption::EncryptionManager;
        use tempfile::TempDir;
        use tokio::fs::write;

        let temp_dir = TempDir::new().unwrap();
        let plain_file = temp_dir.path().join("plain.mp4");
        let encrypted_source = temp_dir.path().join("encrypted_source.mp4");
        let encrypted_file = temp_dir.path().join("encrypted.mp4");

        // Create test content
        let content: Vec<u8> = (0..10_000).map(|i| (i % 256) as u8).collect();
        write(&plain_file, &content).await.unwrap();
        write(&encrypted_source, &content).await.unwrap();

        // Encrypt one file
        let mut encryption_manager = EncryptionManager::new().unwrap();
        encryption_manager
            .enable_encryption("test_mixed_streaming")
            .unwrap();
        encryption_manager
            .encrypt_file(&encrypted_source, &encrypted_file)
            .await
            .unwrap();

        // Start local server and enable encryption
        let mut server = LocalServer::new().await.unwrap();

        // Enable encryption on the server's encryption manager
        {
            let mut server_enc_mgr = server.encryption_manager.lock().await;
            server_enc_mgr
                .enable_encryption("test_mixed_streaming")
                .unwrap();
        }

        let port = server.start().await.unwrap();

        // Register both plain and encrypted content
        server
            .register_content("plain-video", plain_file.clone(), false)
            .await
            .unwrap();
        server
            .register_content("encrypted-video", encrypted_file.clone(), true)
            .await
            .unwrap();

        let client = reqwest::Client::new();

        // Test plain content
        let plain_url = format!("http://127.0.0.1:{}/movies/plain-video", port);
        let response = client
            .get(&plain_url)
            .header("Range", "bytes=1000-1999")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 206);
        let plain_range = response.bytes().await.unwrap();
        assert_eq!(plain_range.to_vec(), content[1000..2000]);

        // Test encrypted content
        let encrypted_url = format!("http://127.0.0.1:{}/movies/encrypted-video", port);
        let response = client
            .get(&encrypted_url)
            .header("Range", "bytes=1000-1999")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 206);
        let encrypted_range = response.bytes().await.unwrap();
        assert_eq!(encrypted_range.to_vec(), content[1000..2000]);

        // Both should return the same content
        assert_eq!(plain_range, encrypted_range);

        // Clean up
        server.unregister_content("plain-video").await.unwrap();
        server.unregister_content("encrypted-video").await.unwrap();
        server.stop().await.unwrap();
        encryption_manager.disable_encryption().unwrap();
    }

    #[tokio::test]
    async fn test_health_check_endpoint() {
        let mut server = LocalServer::new().await.unwrap();
        let port = server.start().await.unwrap();

        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/health", port);

        // Test health check endpoint
        let response = client.get(&url).send().await.unwrap();

        assert_eq!(response.status(), 200);

        let json: serde_json::Value = response.json().await.unwrap();
        assert_eq!(json["status"], "ok");
        assert_eq!(json["service"], "kiyya-local-server");

        server.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_status_endpoint_no_streams() {
        let mut server = LocalServer::new().await.unwrap();
        let port = server.start().await.unwrap();

        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/status", port);

        // Test status endpoint with no active streams
        let response = client.get(&url).send().await.unwrap();

        assert_eq!(response.status(), 200);

        let json: serde_json::Value = response.json().await.unwrap();
        assert_eq!(json["status"], "ok");
        assert_eq!(json["service"], "kiyya-local-server");
        assert_eq!(json["active_streams"], 0);
        assert_eq!(json["encrypted_streams"], 0);
        assert_eq!(json["unencrypted_streams"], 0);
        assert_eq!(json["total_content_size_bytes"], 0);

        server.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_status_endpoint_with_streams() {
        use tempfile::TempDir;
        use tokio::fs::write;

        let temp_dir = TempDir::new().unwrap();
        let file1 = temp_dir.path().join("video1.mp4");
        let file2 = temp_dir.path().join("video2.mp4");
        let file3 = temp_dir.path().join("video3.mp4");

        // Create test files with different sizes
        let content1: Vec<u8> = vec![0; 1000];
        let content2: Vec<u8> = vec![0; 2000];
        let content3: Vec<u8> = vec![0; 3000];

        write(&file1, &content1).await.unwrap();
        write(&file2, &content2).await.unwrap();
        write(&file3, &content3).await.unwrap();

        let mut server = LocalServer::new().await.unwrap();
        let port = server.start().await.unwrap();

        // Register content (2 unencrypted, 1 encrypted)
        server
            .register_content("video1", file1, false)
            .await
            .unwrap();
        server
            .register_content("video2", file2, false)
            .await
            .unwrap();
        server
            .register_content("video3", file3, true)
            .await
            .unwrap();

        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/status", port);

        // Test status endpoint with active streams
        let response = client.get(&url).send().await.unwrap();

        assert_eq!(response.status(), 200);

        let json: serde_json::Value = response.json().await.unwrap();
        assert_eq!(json["status"], "ok");
        assert_eq!(json["service"], "kiyya-local-server");
        assert_eq!(json["active_streams"], 3);
        assert_eq!(json["encrypted_streams"], 1);
        assert_eq!(json["unencrypted_streams"], 2);
        assert_eq!(json["total_content_size_bytes"], 6000);

        server.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_health_and_status_endpoints_cors() {
        let mut server = LocalServer::new().await.unwrap();
        let port = server.start().await.unwrap();

        let client = reqwest::Client::new();

        // Test CORS on health endpoint
        let health_url = format!("http://127.0.0.1:{}/health", port);
        let response = client
            .get(&health_url)
            .header("Origin", "http://localhost:3000")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        assert!(response
            .headers()
            .contains_key("access-control-allow-origin"));

        // Test CORS on status endpoint
        let status_url = format!("http://127.0.0.1:{}/status", port);
        let response = client
            .get(&status_url)
            .header("Origin", "http://localhost:3000")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        assert!(response
            .headers()
            .contains_key("access-control-allow-origin"));

        server.stop().await.unwrap();
    }
}

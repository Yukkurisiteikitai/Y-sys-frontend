document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://127.0.0.1:8000';
    let sessionId = null;

    // DOM要素の取得
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatHistory = document.getElementById('chat-history');
    const thinkingContainer = document.getElementById('thinking-process-container');
    const thinkingProcess = document.getElementById('thinking-process');

    /**
     * Server-Sent Events (SSE) のメッセージを解析するパーサー。
     * 1行ずつデータをpushして、完全なメッセージが構築されたらコールバックを呼び出す。
     */
    class SSEParser {
        constructor(onMessage) {
            this.onMessage = onMessage;
            this.eventName = '';
            this.dataBuffer = '';
        }

        push(line) {
            // コメント行は無視
            if (line.startsWith(':')) {
                return;
            }

            // 空行はメッセージの区切り
            if (line === '') {
                if (this.eventName && this.dataBuffer) {
                    try {
                        // Pythonのdictリテラル風の文字列を正規のJSON形式に変換する
                        const jsonString = this.dataBuffer
                            .replace(/'/g, '"')      // シングルクォートをダブルクォートに
                            .replace(/None/g, 'null')   // None を null に
                            .replace(/True/g, 'true')   // True を true に
                            .replace(/False/g, 'false'); // False を false に
                        const data = JSON.parse(jsonString);
                        this.onMessage(this.eventName, data);
                    } catch (e) {
                        console.error("Failed to parse data:", this.dataBuffer, e);
                    }
                }
                // 次のメッセージのためにバッファをリセット
                this.eventName = '';
                this.dataBuffer = '';
                return;
            }

            if (line.startsWith('event:')) {
                this.eventName = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
                // 複数行のdataに対応するため追記する
                this.dataBuffer += line.substring(5).trim();
            }
        }
    }

    // 1. セッションを作成
    const createSession = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({"metadata": {"client_info": "api_test_client"}}) // サーバー仕様に合わせて空のボディを送信
            });
            if (!response.ok) throw new Error(`Session creation failed: ${response.statusText}`);
            const data = await response.json();
            sessionId = data.session_id;
            console.log('Session created:', sessionId);
        } catch (error) {
            console.error('Error creating session:', error);
            appendMessage('assistant', 'APIへの接続に失敗しました。サーバーが起動しているか確認してください。');
            messageInput.disabled = true;
            sendButton.disabled = true;
        }
    };

    // フォーム送信時の処理
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (!message || !sessionId) return;

        appendMessage('user', message);
        messageInput.value = '';
        setLoading(true);

        await handleStream(message);
    });

    // ストリーム処理
    const handleStream = async (message) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/messages/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ message: message, sensitivity_level: 'medium' })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            // メッセージ受信時の処理として processEvent を渡してパーサーを初期化
            const parser = new SSEParser(processEvent);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                // すべての改行コードに対応
                const lines = buffer.split(/\r\n|\r|\n/);
                buffer = lines.pop() || ''; // 不完全な最後の行をバッファに残す

                for (const line of lines) {
                    parser.push(line); // 1行ずつパーサーに渡して処理
                }
            }
        } catch (error) {
            console.error('Streaming error:', error);
            appendMessage('assistant', `エラーが発生しました: ${error.message}`);
            setLoading(false);
        }
    };

    // SSEイベントを解釈し、UIを更新する
    const processEvent = (event, data) => {
        console.log(event, data);
        let phaseBox;

        const formatPhaseName = (phase) => {
            return phase.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        };

        switch (event) {
            case 'phase_start':
                phaseBox = document.createElement('div');
                phaseBox.classList.add('phase-box');
                phaseBox.id = `phase-${data.phase}`;
                
                const title = document.createElement('h3');
                title.textContent = formatPhaseName(data.phase);
                phaseBox.appendChild(title);

                const contentDiv = document.createElement('div');
                contentDiv.classList.add('phase-content');
                phaseBox.appendChild(contentDiv);

                thinkingProcess.appendChild(phaseBox);
                break;

            case 'abstract_result':
                phaseBox = document.getElementById('phase-abstract_recognition');
                if (phaseBox) {
                    const content = phaseBox.querySelector('.phase-content');
                    const emotions = Array.isArray(data.emotional_state) ? data.emotional_state.join(', ') : 'N/A';
                    const pattern = data.cognitive_pattern || 'N/A';
                    content.innerHTML = `<p><strong>Emotions:</strong> ${emotions}</p><p><strong>Pattern:</strong> ${pattern}</p>`;
                }
                break;

            case 'concrete_links':
                phaseBox = document.getElementById('phase-concrete_understanding');
                if (phaseBox) {
                    const content = phaseBox.querySelector('.phase-content');
                    let episodesHtml = data.related_episodes?.map((ep, i) => 
                        `<li>Ep${i+1}: "${ep.text_snippet.substring(0, 70)}..." (Score: ${ep.relevance_score.toFixed(2)})</li>`
                    ).join('') || '<li>No related episodes found.</li>';
                    
                    content.innerHTML = `<p>Found ${data.total_retrieved} total episodes.</p><ul>${episodesHtml}</ul>`;
                }
                break;

            case 'thought_process':
                phaseBox = document.getElementById('phase-response_generation');
                if (phaseBox) {
                    const content = phaseBox.querySelector('.phase-content');
                    const decision = data.inferred_decision || 'N/A';
                    const action = data.inferred_action || 'N/A';
                    content.innerHTML = `<p><strong>Decision:</strong> ${decision}</p><p><strong>Action:</strong> ${action}</p>`;
                }
                break;
            
            case 'phase_complete':
                phaseBox = document.getElementById(`phase-${data.phase}`);
                if (phaseBox) {
                    const title = phaseBox.querySelector('h3');
                    if (title) title.textContent += ` (${data.duration_ms.toFixed(2)} ms)`;
                }
                break;

            case 'final_response':
                appendMessage('assistant', data.response.dialogue);
                break;

            case 'stream_end':
                setLoading(false);
                break;

            case 'error':
                appendMessage('assistant', `エラー: ${data.message} (コード: ${data.code})`);
                setLoading(false);
                break;
        }
        thinkingContainer.scrollTop = thinkingContainer.scrollHeight;
    };

    // --- UIヘルパー関数 ---

    const appendMessage = (sender, text) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        const p = document.createElement('p');
        p.textContent = text;
        messageElement.appendChild(p);
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const setLoading = (isLoading) => {
        messageInput.disabled = isLoading;
        sendButton.disabled = isLoading;
        thinkingContainer.classList.toggle('hidden', !isLoading);
        if (!isLoading) {
            thinkingProcess.innerHTML = '';
        }
    };

    // 初期化
    createSession();
});
function getSeedData(board) {
    return board.data || { objects: [] };
}

function invokeOnLoad(board, payload) {
    if (typeof board.options.onLoad === 'function') {
        board.options.onLoad(payload);
    }
}

export function getCsrfToken(board) {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        || window.csrfToken
        || board.options.csrfToken
        || '';
}

export async function loadExistingBoard(board) {
    try {
        const boardId = board.options.boardId;

        if (!boardId || !board.options.apiUrl) {
            console.log('📦 MoodBoard: нет boardId или apiUrl, загружаем пустую доску');
            const seedData = getSeedData(board);
            board.dataManager.loadData(seedData);
            invokeOnLoad(board, { success: true, data: seedData });
            return;
        }

        console.log(`📦 MoodBoard: загружаем доску ${boardId} с ${board.options.apiUrl}`);

        const loadUrl = board.options.apiUrl.endsWith('/')
            ? `${board.options.apiUrl}load/${boardId}`
            : `${board.options.apiUrl}/load/${boardId}`;

        const response = await fetch(loadUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(board),
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const boardData = await response.json();

        if (boardData && boardData.data) {
            console.log('✅ MoodBoard: данные загружены с сервера', boardData.data);
            board.dataManager.loadData(boardData.data);
            invokeOnLoad(board, { success: true, data: boardData.data });
        } else {
            console.log('📦 MoodBoard: нет данных с сервера, загружаем пустую доску');
            const seedData = getSeedData(board);
            board.dataManager.loadData(seedData);
            invokeOnLoad(board, { success: true, data: seedData });
        }
    } catch (error) {
        console.warn('⚠️ MoodBoard: ошибка загрузки доски, создаем новую:', error.message);
        const seedData = getSeedData(board);
        board.dataManager.loadData(seedData);
        invokeOnLoad(board, { success: false, error: error.message, data: seedData });
    }
}

export async function loadFromApi(board, boardId = null) {
    const targetBoardId = boardId || board.options.boardId;
    if (!targetBoardId) {
        throw new Error('boardId не указан');
    }

    const originalBoardId = board.options.boardId;
    board.options.boardId = targetBoardId;

    try {
        await loadExistingBoard(board);
    } finally {
        board.options.boardId = originalBoardId;
    }
}

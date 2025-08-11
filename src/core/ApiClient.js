// src/core/ApiClient.js
export class ApiClient {
    constructor(baseUrl, authToken = null) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }

    async getBoard(boardId) {
        // Заглушка для API запроса
        console.log('API: Getting board', boardId);
        return {
            data: {
                id: boardId,
                name: 'Demo Board',
                objects: []
            }
        };
    }

    async saveBoard(boardId, boardData) {
        // Заглушка для API запроса
        console.log('API: Saving board', boardId, boardData);
        return {
            data: boardData
        };
    }
}
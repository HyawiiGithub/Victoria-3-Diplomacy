const ROWS = 6;
const COLS = 7;
let currentPlayer = 'red';
let board = [];

const boardDiv = document.getElementById('board');
const resetBtn = document.getElementById('reset');

function createBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  boardDiv.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', handleMove);
      boardDiv.appendChild(cell);
    }
  }
}

function handleMove(e) {
  const col = parseInt(e.target.dataset.col);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) {
      board[r][col] = currentPlayer;
      const cell = document.querySelector(
        `.cell[data-row='${r}'][data-col='${col}']`
      );
      cell.classList.add(currentPlayer);
      if (checkWin(r, col)) {
        alert(`${currentPlayer.toUpperCase()} wins!`);
        disableBoard();
      } else {
        currentPlayer = currentPlayer === 'red' ? 'yellow' : 'red';
      }
      break;
    }
  }
}

function checkWin(row, col) {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];
  for (const [dr, dc] of directions) {
    let count = 1;
    count += countDirection(row, col, dr, dc);
    count += countDirection(row, col, -dr, -dc);
    if (count >= 4) return true;
  }
  return false;
}

function countDirection(row, col, dr, dc) {
  let r = row + dr;
  let c = col + dc;
  let count = 0;
  while (
    r >= 0 && r < ROWS &&
    c >= 0 && c < COLS &&
    board[r][c] === currentPlayer
  ) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

function disableBoard() {
  document.querySelectorAll('.cell').forEach(cell => {
    cell.replaceWith(cell.cloneNode(true));
  });
}

resetBtn.addEventListener('click', () => {
  currentPlayer = 'red';
  createBoard();
});

createBoard();

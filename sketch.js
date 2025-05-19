// Genel değişkenler
let nodes = [];
let edges = [];
let mstEdges = [];
let currentMode = 'add'; // 'add' veya 'move'
let selectedNode = null;
let canvas;
let runMode = 'instant'; // 'instant', 'step', 'compare'
let currentStep = 0;
let algorithmSteps = [];

// Algoritma değişkenleri
let animationSpeed = 500; // ms
let isAnimating = false;
let compareMode = {
    kruskal: { edges: [], currentStep: 0 },
    prim: { edges: [], currentStep: 0 }
};

// Renk paleti
const colors = {
    node: {
        fill: 'rgb(52, 152, 219)',
        stroke: 'rgb(41, 128, 185)',
        text: 'white'
    },
    edge: {
        normal: 'rgba(189, 195, 199, 0.4)',
        selected: 'rgb(46, 204, 113)',
        highlight: 'rgb(241, 196, 15)',
        rejected: 'rgba(231, 76, 60, 0.4)'
    },
    step: [
        'rgb(26, 188, 156)',
        'rgb(46, 204, 113)',
        'rgb(52, 152, 219)',
        'rgb(155, 89, 182)',
        'rgb(241, 196, 15)',
        'rgb(230, 126, 34)',
        'rgb(231, 76, 60)'
    ]
};

// Node sınıfı
class Node {
    constructor(x, y) {
        this.x = constrain(x, 10, width - 10);
        this.y = constrain(y, 10, height - 10);
        this.id = nodes.length;
    }

    draw(highlight = false) {
        push();
        fill(colors.node.fill);
        stroke(highlight ? colors.edge.highlight : colors.node.stroke);
        strokeWeight(highlight ? 3 : 2);
        ellipse(this.x, this.y, 20, 20);
        fill(colors.node.text);
        noStroke();
        textAlign(CENTER, CENTER);
        text(this.id, this.x, this.y);
        pop();
    }

    isInside(px, py) {
        return dist(px, py, this.x, this.y) < 10;
    }
}

// Edge sınıfı
class Edge {
    constructor(node1, node2) {
        this.node1 = node1;
        this.node2 = node2;
        this.weight = dist(node1.x, node1.y, node2.x, node2.y);
    }

    draw(color = 'gray', showWeight = true) {
        push();
        stroke(color);
        strokeWeight(2);
        line(this.node1.x, this.node1.y, this.node2.x, this.node2.y);
        
        if (showWeight) {
            let midX = (this.node1.x + this.node2.x) / 2;
            let midY = (this.node1.y + this.node2.y) / 2;
            fill(0);
            noStroke();
            textAlign(CENTER, CENTER);
            text(Math.round(this.weight), midX, midY);
        }
        pop();
    }
}

// Union-Find veri yapısı
class UnionFind {
    constructor(size) {
        this.parent = Array.from({length: size}, (_, i) => i);
        this.rank = Array(size).fill(0);
    }

    find(x) {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
    }

    union(x, y) {
        let rootX = this.find(x);
        let rootY = this.find(y);

        if (rootX === rootY) return false;

        if (this.rank[rootX] < this.rank[rootY]) {
            [rootX, rootY] = [rootY, rootX];
        }
        this.parent[rootY] = rootX;
        if (this.rank[rootX] === this.rank[rootY]) {
            this.rank[rootX]++;
        }
        return true;
    }
}

// Kruskal Algoritması
function kruskalMST() {
    console.log("Kruskal başlatılıyor...");
    mstEdges = [];
    let sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
    let uf = new UnionFind(nodes.length);
    let totalCost = 0;

    for (let edge of sortedEdges) {
        if (uf.union(edge.node1.id, edge.node2.id)) {
            console.log(`Kenar ekleniyor: ${edge.node1.id}-${edge.node2.id}`);
            mstEdges.push(edge);
            totalCost += edge.weight;
        }
    }

    const totalCostElement = document.getElementById('totalCost');
    if (totalCostElement) {
        totalCostElement.textContent = Math.round(totalCost);
    }

    return mstEdges;
}

// Prim Algoritması
function primMST() {
    console.log("Prim başlatılıyor...");
    if (nodes.length === 0) return [];
    
    mstEdges = [];
    let totalCost = 0;
    let visited = new Set([0]);

    while (visited.size < nodes.length) {
        let minEdge = null;
        let minWeight = Infinity;

        for (let edge of edges) {
            let node1Visited = visited.has(edge.node1.id);
            let node2Visited = visited.has(edge.node2.id);

            if (node1Visited !== node2Visited) {
                if (edge.weight < minWeight) {
                    minEdge = edge;
                    minWeight = edge.weight;
                }
            }
        }

        if (minEdge) {
            console.log(`Kenar ekleniyor: ${minEdge.node1.id}-${minEdge.node2.id}`);
            mstEdges.push(minEdge);
            totalCost += minEdge.weight;
            visited.add(visited.has(minEdge.node1.id) ? minEdge.node2.id : minEdge.node1.id);
        }
    }

    const totalCostElement = document.getElementById('totalCost');
    if (totalCostElement) {
        totalCostElement.textContent = Math.round(totalCost);
    }

    return mstEdges;
}

// Öncelik Kuyruğu (Prim algoritması için)
class PriorityQueue {
    constructor() {
        this.values = [];
    }

    enqueue(element, priority) {
        this.values.push({element, priority});
        this.sort();
    }

    dequeue() {
        return this.values.shift().element;
    }

    sort() {
        this.values.sort((a, b) => a.priority - b.priority);
    }

    isEmpty() {
        return this.values.length === 0;
    }
}

// Rastgele graf oluştur
function createRandomGraph() {
    clearGraph();
    const numNodes = 10;
    const padding = 50;
    
    for (let i = 0; i < numNodes; i++) {
        const x = random(padding, width - padding);
        const y = random(padding, height - padding);
        addNode(x, y);
    }
}

// Kenarları güncelle
function updateEdges() {
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            edges.push(new Edge(nodes[i], nodes[j]));
        }
    }
}

// Grafı çalıştır
function runGraph() {
    console.log("runGraph çağrıldı");
    if (nodes.length < 2) {
        console.log("En az 2 nokta gerekli!");
        return;
    }

    mstEdges = [];
    algorithmSteps = [];
    const algorithmSelect = document.getElementById('algorithmSelect');
    const runModeSelect = document.getElementById('runMode');
    const nextStepBtn = document.getElementById('nextStepBtn');
    
    if (!algorithmSelect || !runModeSelect) return;
    
    const selectedAlgorithm = algorithmSelect.value;
    runMode = runModeSelect.value;

    if (runMode === 'instant') {
        // Anlık çözüm
        if (selectedAlgorithm === 'kruskal') {
            mstEdges = kruskalMST();
        } else {
            mstEdges = primMST();
        }
        if (nextStepBtn) nextStepBtn.classList.add('hidden');
    } else if (runMode === 'step') {
        // Adım adım çözüm
        if (selectedAlgorithm === 'kruskal') {
            algorithmSteps = prepareKruskalSteps();
        } else {
            algorithmSteps = preparePrimSteps();
        }
        currentStep = 0;
        if (nextStepBtn) nextStepBtn.classList.remove('hidden');
        nextStep(); // İlk adımı göster
    } else if (runMode === 'compare') {
        // Karşılaştırmalı çözüm
        compareMode.kruskal.edges = kruskalMST();
        compareMode.prim.edges = primMST();
        mstEdges = [...compareMode.kruskal.edges]; // Başlangıçta Kruskal'ı göster
        if (nextStepBtn) nextStepBtn.classList.add('hidden');
    }
}

// p5.js setup fonksiyonu
function setup() {
    const container = document.getElementById('canvasContainer');
    if (!container) return;

    // Container genişliğini al ve yüksekliği 4:3 oranında ayarla
    const w = container.offsetWidth;
    const h = Math.floor(w * 0.75); // 4:3 oranı için

    canvas = createCanvas(w, h);
    canvas.parent('canvasContainer');
    
    setupEventListeners();
}

// Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
function windowResized() {
    const container = document.getElementById('canvasContainer');
    if (!container || !canvas) return;

    const w = container.offsetWidth;
    const h = Math.floor(w * 0.75);
    
    resizeCanvas(w, h);
    
    // Noktaların pozisyonlarını yeni boyuta göre ölçekle
    const oldWidth = width;
    const oldHeight = height;
    
    for (let node of nodes) {
        node.x = (node.x / oldWidth) * w;
        node.y = (node.y / oldHeight) * h;
    }
    
    // Kenarları güncelle
    updateEdges();
}

// Event listener'ları kur
function setupEventListeners() {
    const addNodeBtn = document.getElementById('addNodeBtn');
    const moveNodeBtn = document.getElementById('moveNodeBtn');
    const runModeSelect = document.getElementById('runMode');
    const runBtn = document.getElementById('runBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const resetBtn = document.getElementById('resetBtn');
    const randomBtn = document.getElementById('randomBtn');
    const clearBtn = document.getElementById('clearBtn');

    if (addNodeBtn) {
        addNodeBtn.addEventListener('click', () => {
            currentMode = 'add';
            addNodeBtn.classList.add('bg-blue-700');
            moveNodeBtn?.classList.remove('bg-purple-700');
        });
    }

    if (moveNodeBtn) {
        moveNodeBtn.addEventListener('click', () => {
            currentMode = 'move';
            moveNodeBtn.classList.add('bg-purple-700');
            addNodeBtn?.classList.remove('bg-blue-700');
        });
    }

    if (runModeSelect) {
        runModeSelect.addEventListener('change', (e) => {
            runMode = e.target.value;
            const currentModeSpan = document.getElementById('currentMode');
            if (currentModeSpan) {
                currentModeSpan.textContent = e.target.options[e.target.selectedIndex].text;
            }
            
            // Butonların görünürlüğünü güncelle
            if (nextStepBtn) {
                nextStepBtn.classList.toggle('hidden', runMode !== 'step');
            }
            
            // Adım adım mod seçildiğinde çalıştır butonunun metnini güncelle
            if (runBtn) {
                runBtn.textContent = runMode === 'step' ? 'Başlat' : 'Çalıştır';
            }
            
            resetGraph(); // Modu değiştirdiğimizde grafiği sıfırla
        });
    }

    if (runBtn) {
        runBtn.addEventListener('click', () => {
            console.log("Çalıştır butonuna basıldı");
            runGraph();
        });
    }

    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', () => {
            console.log("Sonraki adım butonuna basıldı");
            nextStep();
        });
    }

    if (resetBtn) resetBtn.addEventListener('click', resetGraph);
    if (randomBtn) randomBtn.addEventListener('click', createRandomGraph);
    if (clearBtn) clearBtn.addEventListener('click', clearGraph);
}

// p5.js draw fonksiyonu
function draw() {
    background(255);

    if (runMode === 'compare') {
        // Karşılaştırmalı mod için canvas'ı ikiye böl
        push();
        stroke(200);
        line(width/2, 0, width/2, height);
        
        // Sol taraf - Kruskal
        drawGraph(compareMode.kruskal.edges, 0, width/2);
        
        // Sağ taraf - Prim
        drawGraph(compareMode.prim.edges, width/2, width);
        pop();
    } else if (runMode === 'step') {
        // Adım adım çözüm için mevcut durumu göster
        drawGraph(mstEdges);
        
        // Mevcut adımı vurgula
        if (currentStep < algorithmSteps.length) {
            let currentEdge = algorithmSteps[currentStep].edge;
            let color = algorithmSteps[currentStep].type === 'consider' ? 
                colors.edge.highlight : colors.edge.rejected;
            currentEdge.draw(color);
        }
    } else {
        // Normal mod
        drawGraph(mstEdges);
    }

    // Noktaları her zaman en üstte çiz
    for (let node of nodes) {
        node.draw();
    }
}

function drawGraph(mstEdges, startX = 0, endX = width) {
    push();
    translate(startX, 0);
    let graphWidth = endX - startX;
    let scale = graphWidth / width;
    
    // MST dışı kenarları çiz
    for (let edge of edges) {
        if (!mstEdges.includes(edge)) {
            edge.draw(colors.edge.normal);
        }
    }
    
    // MST kenarlarını çiz
    for (let edge of mstEdges) {
        edge.draw(colors.edge.selected, true);
    }
    pop();
}

// Mouse olayları
function mousePressed() {
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        if (currentMode === 'add') {
            addNode(mouseX, mouseY);
        } else if (currentMode === 'move') {
            selectNode(mouseX, mouseY);
        }
    }
}

function mouseDragged() {
    if (currentMode === 'move' && selectedNode) {
        moveNode(mouseX, mouseY);
    }
}

function mouseReleased() {
    selectedNode = null;
}

// Yardımcı fonksiyonlar
function addNode(x, y) {
    const newNode = new Node(x, y);
    nodes.push(newNode);
    updateNodeCount();
    updateEdges();
}

function selectNode(x, y) {
    selectedNode = nodes.find(node => node.isInside(x, y));
}

function moveNode(x, y) {
    if (!selectedNode) return;
    selectedNode.x = constrain(x, 10, width - 10);
    selectedNode.y = constrain(y, 10, height - 10);
    updateEdges();
}

function updateNodeCount() {
    const nodeCountElement = document.getElementById('nodeCount');
    if (nodeCountElement) {
        nodeCountElement.textContent = nodes.length;
    }
}

function updateEdges() {
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            edges.push(new Edge(nodes[i], nodes[j]));
        }
    }
}

function prepareKruskalSteps() {
    let steps = [];
    let sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
    let uf = new UnionFind(nodes.length);

    for (let edge of sortedEdges) {
        if (uf.union(edge.node1.id, edge.node2.id)) {
            steps.push({
                edge: edge,
                type: 'add'
            });
        } else {
            steps.push({
                edge: edge,
                type: 'reject'
            });
        }
    }
    return steps;
}

function preparePrimSteps() {
    let steps = [];
    if (nodes.length === 0) return steps;
    
    let visited = new Set([0]);
    let remainingNodes = new Set(nodes.map(n => n.id));
    remainingNodes.delete(0);

    while (remainingNodes.size > 0) {
        let minEdge = null;
        let minWeight = Infinity;

        for (let edge of edges) {
            let node1Visited = visited.has(edge.node1.id);
            let node2Visited = visited.has(edge.node2.id);

            if (node1Visited !== node2Visited) {
                steps.push({
                    edge: edge,
                    type: 'consider'
                });

                if (edge.weight < minWeight) {
                    minEdge = edge;
                    minWeight = edge.weight;
                }
            }
        }

        if (minEdge) {
            steps.push({
                edge: minEdge,
                type: 'add'
            });
            let newNode = visited.has(minEdge.node1.id) ? minEdge.node2.id : minEdge.node1.id;
            visited.add(newNode);
            remainingNodes.delete(newNode);
        }
    }
    return steps;
}

function nextStep() {
    if (!algorithmSteps || currentStep >= algorithmSteps.length) return;

    let step = algorithmSteps[currentStep];
    if (step.type === 'add') {
        mstEdges.push(step.edge);
    }
    currentStep++;

    // İlerleme durumunu güncelle
    const progressElement = document.getElementById('progress');
    if (progressElement) {
        progressElement.textContent = `${currentStep}/${algorithmSteps.length}`;
    }
}

function resetGraph() {
    mstEdges = [];
    currentStep = 0;
}

function createRandomGraph() {
    clearGraph();
    const numNodes = 10;
    const padding = 50;
    
    for (let i = 0; i < numNodes; i++) {
        const x = random(padding, width - padding);
        const y = random(padding, height - padding);
        addNode(x, y);
    }
}

function clearGraph() {
    nodes = [];
    edges = [];
    mstEdges = [];
    updateNodeCount();
    const totalCostElement = document.getElementById('totalCost');
    if (totalCostElement) {
        totalCostElement.textContent = '0';
    }
} 
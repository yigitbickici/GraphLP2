let nodes = [];
let edges = [];
let mstEdges = [];
let currentMode = 'add';
let selectedNode = null;
let canvas;
let runMode = 'instant';
let currentStep = 0;
let algorithmSteps = [];

let animationSpeed = 500;
let isAnimating = false;

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

class Node {
    constructor(x, y, type = 'distribution_box') {
        this.x = constrain(x, 10, width - 10);
        this.y = constrain(y, 10, height - 10);
        this.id = nodes.length;
        this.type = type;
        this.capacity = type === 'transformer' ? 1000 : type === 'distribution_box' ? 100 : 10;
        this.load = 0;
        this.voltage = type === 'transformer' ? 1000 : type === 'distribution_box' ? 400 : 220;
    }

    draw(highlight = false) {
        push();
        
        let size = 20;
        if (this.type === 'transformer') {
            size = 30;
            fill('rgb(231, 76, 60)');
            stroke(highlight ? colors.edge.highlight : colors.node.stroke);
            strokeWeight(highlight ? 3 : 2);
            rectMode(CENTER);
            rect(this.x, this.y, size, size);
            
            fill('white');
            textSize(16);
            textAlign(CENTER, CENTER);
            text('⚡', this.x, this.y);
        } else if (this.type === 'distribution_box') {
            size = 25;
            fill('rgb(52, 152, 219)');
            stroke(highlight ? colors.edge.highlight : colors.node.stroke);
            strokeWeight(highlight ? 3 : 2);
            
            beginShape();
            for (let i = 0; i < 6; i++) {
                let angle = TWO_PI / 6 * i - TWO_PI / 4;
                let px = this.x + cos(angle) * size/2;
                let py = this.y + sin(angle) * size/2;
                vertex(px, py);
            }
            endShape(CLOSE);
        } else {
            size = 20;
            fill('rgb(46, 204, 113)');
            stroke(highlight ? colors.edge.highlight : colors.node.stroke);
            strokeWeight(highlight ? 3 : 2);
            
            triangle(
                this.x, this.y - size/2,
                this.x - size/2, this.y + size/2,
                this.x + size/2, this.y + size/2
            );
        }
        
        fill('white');
        noStroke();
        textSize(10);
        textAlign(CENTER, CENTER);
        text(this.id, this.x, this.y + (this.type === 'house' ? 0 : 0));
        
        if (this.type !== 'house') {
            textSize(8);
            text(`${this.load}/${this.capacity}kW`, this.x, this.y + size/2 + 10);
            text(`${this.voltage}V`, this.x, this.y + size/2 + 20);
        }
        
        pop();
    }

    isInside(px, py) {
        let size = this.type === 'transformer' ? 30 : this.type === 'distribution_box' ? 25 : 20;
        return dist(px, py, this.x, this.y) < size/2;
    }
}

class Edge {
    constructor(node1, node2) {
        this.node1 = node1;
        this.node2 = node2;
        this.distance = dist(node1.x, node1.y, node2.x, node2.y);
        this.cableType = 'copper';
        this.cableCosts = {
            'copper': 100,
            'aluminum': 60
        };
        this.resistance = this.calculateResistance();
        this.powerLoss = 0;
        this.weight = this.calculateTotalCost();
    }

    calculateResistance() {
        const resistivity = this.cableType === 'copper' ? 1.68e-8 : 2.82e-8;
        const area = 0.0001;
        return (resistivity * this.distance) / area;
    }

    calculateTotalCost() {
        const baseCost = this.distance * this.cableCosts[this.cableType];
        const powerLossCost = this.powerLoss * 50;
        const installationCost = Math.pow(this.distance / 100, 1.5) * 1000;
        return baseCost + powerLossCost + installationCost;
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
            textSize(10);
            text(`${Math.round(this.weight)} TL\n${Math.round(this.distance)}m`, midX, midY);
            
            if (this.powerLoss > 0) {
                text(`Loss: ${this.powerLoss.toFixed(2)}W`, midX, midY + 15);
            }
        }
        pop();
    }

    updatePowerLoss(current) {
        this.powerLoss = current * current * this.resistance;
        this.weight = this.calculateTotalCost();
    }
}

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

function kruskalMST() {
    console.log("Starting Kruskal's algorithm...");
    mstEdges = [];
    let sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
    let uf = new UnionFind(nodes.length);
    let totalCost = 0;

    for (let edge of sortedEdges) {
        if (uf.union(edge.node1.id, edge.node2.id)) {
            console.log(`Adding edge: ${edge.node1.id}-${edge.node2.id}`);
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

function primMST() {
    console.log("Starting Prim's algorithm...");
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
            console.log(`Adding edge: ${minEdge.node1.id}-${minEdge.node2.id}`);
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

function updateEdges() {
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            edges.push(new Edge(nodes[i], nodes[j]));
        }
    }
}

function runGraph() {
    console.log("runGraph called");
    if (nodes.length < 2) {
        console.log("At least 2 points are required!");
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
        if (selectedAlgorithm === 'kruskal') {
            mstEdges = kruskalMST();
        } else {
            mstEdges = primMST();
        }
        if (nextStepBtn) nextStepBtn.classList.add('hidden');
    } else if (runMode === 'step') {
        if (selectedAlgorithm === 'kruskal') {
            algorithmSteps = prepareKruskalSteps();
        } else {
            algorithmSteps = preparePrimSteps();
        }
        currentStep = 0;
        if (nextStepBtn) nextStepBtn.classList.remove('hidden');
        nextStep();
    }
}

function setup() {
    const container = document.getElementById('canvasContainer');
    if (!container) return;

    const w = container.offsetWidth;
    const h = Math.floor(w * 0.75);

    canvas = createCanvas(w, h);
    canvas.parent('canvasContainer');
    
    setupEventListeners();
}

function windowResized() {
    const container = document.getElementById('canvasContainer');
    if (!container || !canvas) return;

    const w = container.offsetWidth;
    const h = Math.floor(w * 0.75);
    
    resizeCanvas(w, h);
    
    const oldWidth = width;
    const oldHeight = height;
    
    for (let node of nodes) {
        node.x = (node.x / oldWidth) * w;
        node.y = (node.y / oldHeight) * h;
    }
    
    updateEdges();
}

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
            
            if (nextStepBtn) {
                nextStepBtn.classList.toggle('hidden', runMode !== 'step');
            }
            
            if (runBtn) {
                runBtn.textContent = runMode === 'step' ? 'Start' : 'Run';
            }
            
            resetGraph();
        });
    }

    if (runBtn) {
        runBtn.addEventListener('click', () => {
            console.log("Run button clicked");
            runGraph();
        });
    }

    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', () => {
            console.log("Next step button clicked");
            nextStep();
        });
    }

    if (resetBtn) resetBtn.addEventListener('click', resetGraph);
    if (randomBtn) randomBtn.addEventListener('click', createRandomGraph);
    if (clearBtn) clearBtn.addEventListener('click', clearGraph);
}

function draw() {
    background(255);

    if (runMode === 'step') {
        drawGraph(mstEdges);
        
        if (currentStep < algorithmSteps.length) {
            let currentEdge = algorithmSteps[currentStep].edge;
            let color = algorithmSteps[currentStep].type === 'consider' ? 
                colors.edge.highlight : colors.edge.rejected;
            currentEdge.draw(color);
        }
    } else {
        drawGraph(mstEdges);
    }

    for (let node of nodes) {
        node.draw();
    }
}

function drawGraph(mstEdges, startX = 0, endX = width) {
    for (let edge of edges) {
        if (!mstEdges.includes(edge)) {
            edge.draw(colors.edge.normal);
        }
    }
    
    for (let edge of mstEdges) {
        edge.draw(colors.edge.selected, true);
    }
}

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

function addNode(x, y) {
    const nodeTypeSelect = document.getElementById('nodeType');
    const type = nodeTypeSelect ? nodeTypeSelect.value : 'distribution_box';
    const newNode = new Node(x, y, type);
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
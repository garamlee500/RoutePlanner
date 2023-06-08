#include <pybind11/pybind11.h>

#include <unordered_set>
#include <vector>
#include <fstream>
#include <cmath>
#include <list>
#include <utility>
#include <limits>
#include <algorithm>
#include <unordered_map>
#include <random>
#include <functional>

namespace py = pybind11;
using namespace std;
// magic command
// c++ -Ofast -Wall -shared -std=c++11 -fPIC $(python3 -m pybind11 --includes) graph_algorithms.cpp -o graph_algorithms$(python3-config --extension-suffix)

// "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.33.31629\bin\Hostx64\x64\cl.exe" /O2 /fp:fast /LD /I "C:\Program Files (x86)\Windows Kits\10\Include\10.0.19041.0\shared" /I "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.33.31629\include" /I "C:\Program Files (x86)\Windows Kits\10\Include\10.0.19041.0\ucrt" /I "C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\include" /I "C:\Users\garam\AppData\Roaming\Python\Python39\site-packages\pybind11\include" C:\Users\garam\Downloads\SouthamptonMap\cpp_files\graph_algorithms.cpp "C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\libs\python39.lib" /link  /LIBPATH:"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.33.31629\lib\x64" /LIBPATH:"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.19041.0\um\x64" /LIBPATH:"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.19041.0\ucrt\x64" /OUT:"graph_algorithms.pyd"

// Powershell script given to me by God - correctly identifies suffix to!
// & "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.33.31629\bin\Hostx64\x64\cl.exe" /O2 /fp:fast /LD /I "C:\Program Files (x86)\Windows Kits\10\Include\10.0.19041.0\shared" /I "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.33.31629\include" /I "C:\Program Files (x86)\Windows Kits\10\Include\10.0.19041.0\ucrt" /I "C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\include" /I "C:\Users\garam\AppData\Roaming\Python\Python39\site-packages\pybind11\include" graph_algorithms.cpp "C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\libs\python39.lib" /link  /LIBPATH:"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.33.31629\lib\x64" /LIBPATH:"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.19041.0\um\x64" /LIBPATH:"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.19041.0\ucrt\x64" /OUT:"graph_algorithms"$(& "C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\python" -c "import distutils.sysconfig;print(distutils.sysconfig.get_config_var('EXT_SUFFIX'))")


// For college computers - cleans after itself!
// H:\Documents\Apps\cl\cl.exe /O2 /fp:fast /LD /I  H:\Documents\Apps\cl\shared-include /I  H:\Documents\Apps\cl\ucrt-include /I  H:\Documents\Apps\cl\python-include /I  H:\Documents\Apps\cl\pybind-include /I  H:\Documents\Apps\cl\msvc-include graph_algorithms.cpp H:\Documents\Apps\cl\python39.lib /link /LIBPATH:"H:\Documents\Apps\cl\libs" /OUT:"graph_algorithms"$(& " H:\Documents\Apps\python39\python.exe" -c "import distutils.sysconfig;print(distutils.sysconfig.get_config_var('EXT_SUFFIX'))"); Remove-Item graph_algorithms.exp; Remove-Item graph_algorithms.lib; Remove-Item graph_algorithms.obj;


// use constexpr to define constants
constexpr int EARTH_RADIUS = 6371000;
constexpr double PI = 3.14159265358979323846;

// https://en.cppreference.com/w/cpp/numeric/random/uniform_int_distribution
random_device rd;  // a seed source for the random number engine
mt19937 gen(rd()); // mersenne_twister_engine seeded with rd()


struct Node {
    int index;
    double x, y;
    Node(int index, double x, double y):
        index(index),
        x(x),
        y(y)
    {}
};


// A Generic LRU cache that takes integers as inputs, with automatic data generation when cache miss occurs
template <class T>
class LRUcache{
private:
    unordered_map<int, T> cachedData;
    unordered_map<int, list<int>::iterator> locationOfInputsInLRUInputs;
    // A queue of objects
    list<int> LRUInputs;
    function<T(int)> targetFunction;
    unsigned int maxSize;


    void storeDataWithoutCacheHitChecks(int x, T& data){
        // Stores data without checking for cache hits
        cachedData[x] = data;
        LRUInputs.push_back(x);
        locationOfInputsInLRUInputs[x] = prev(LRUInputs.end());

        if (LRUInputs.size() > maxSize){
            // Cache has got too big - erase element Least Recently Used
            int erasingInput = LRUInputs.front();
            cachedData.erase(erasingInput);
            locationOfInputsInLRUInputs.erase(erasingInput);
            LRUInputs.pop_front();
        }
    }
public:

    // Cache initialises with function to run if cache miss occurs
    // Max size is point at which cache data is deleted
    LRUcache(function<T(int)> targetFunction, unsigned int maxSize = 100):
        targetFunction(targetFunction),
        maxSize(maxSize)
        {}

    void storeData(int x, T& data){
        if (cachedData.count(x)){
            LRUInputs.erase(locationOfInputsInLRUInputs[x]);
            LRUInputs.push_back(x);
            locationOfInputsInLRUInputs[x] = prev(LRUInputs.end());
        }
        else{
            storeDataWithoutCacheHitChecks(x, data);
        }
    }

    T getData(int x){
        if (cachedData.count(x)){
            // Cache hit
            // Move input data to back of LRU list
            LRUInputs.erase(locationOfInputsInLRUInputs[x]);
            LRUInputs.push_back(x);
            locationOfInputsInLRUInputs[x] = prev(LRUInputs.end());
            return cachedData[x];
        }
        else{
            // Cache miss
            T result = targetFunction(x);
            storeDataWithoutCacheHitChecks(x, result);
            return result;
        }
    }


};

class DijkstraHeap{
    /*
    * DijkstraHeap is a highly specific binary heap, for use with standard dijkstra
    * Expects nodes to be labelled from 0 to n-1, where n is the number of nodes
    */
private:
    // Binary heap of all nodes
    vector<int> heap;
    // Vector storing heap indexes for all nodes
    vector<int> vertexIndices;
    // Lambda function used to compare nodes - likely simply compares the two nodes' distances in a distance table
    // of nodes
    function<bool(int, int)> nodeComparator;
public:
    unsigned int size(){
        // Get the size of the heap
        return heap.size();
    }

    // Constructor of DijkstraHeap
    // startNode - node number of node that is the 'start' node for the instance of Dijkstra's algorithm running
    // nodeCount - the total number of nodes - note nodes are expected to be named: 0, 1,..., nodeCount - 1
    // nodeComparator - a function taking in two integers (nodeA, nodeB) and returns True if the current shortest path
    //      to nodeA from startNode is less than the current shortest path to nodeB from startNode, or False otherwise
    DijkstraHeap(int startNode, int nodeCount, function<bool(int, int)> nodeComparator):
        nodeComparator(nodeComparator)
    {
        // Reserve space for vectors
        heap.reserve(startNode);
        vertexIndices.reserve(nodeCount);


        // Creates min-heap with start node at root
        heap.push_back(startNode);

        for (int i = 0; i < startNode; i++){
            // Push all nodes onto heap
            heap.push_back(i);

            // Indices of nodes before start node have been shifted up by one, due to startNode appearing at index 0
            // on heap
            vertexIndices.push_back(i+1);
        }
        vertexIndices.push_back(0);
        for (int i = startNode+1; i < nodeCount; i++){
            heap.push_back(i);
            vertexIndices.push_back(i);
        }
    }

    bool nodePresent(int node){
        // All nodes removed from heap are marked as -1 on vertexIndices - this can be used to check if a node
        // is present on the heap or not
        return vertexIndices[node] != -1;
    }

    int peekTop(){
        // Gets at top of DijkstraHeap
        return heap[0];
    }
    int popTop(){
        int topItem = peekTop();

        // Swap root with last item in heap (then delete former root) then reheapify to remove root from heap
        vertexIndices[heap.back()] = 0;
        vertexIndices[topItem] = -1;
        heap[0] = heap.back();
        heap.pop_back();

        unsigned int nodeIndex = 0;

        // Children nodes are 2*i + 1 and 2*i + 2


        // Loop until current node has node children
        while (nodeIndex * 2 + 1 < heap.size()){

            // Check if current node has a second child
            if (nodeIndex * 2 + 2 < heap.size()){
                // First child is less than second child
                if (nodeComparator(heap[nodeIndex*2+1], heap[nodeIndex*2 + 2])){
                    // First child is less than current node
                    if (nodeComparator(heap[nodeIndex*2+1], heap[nodeIndex])){
                        // Swap current node with first child
                        int tempHeapValue = heap[nodeIndex*2+1];
                        vertexIndices[tempHeapValue] = nodeIndex;
                        heap[nodeIndex*2+1] = heap[nodeIndex];
                        vertexIndices[heap[nodeIndex]] = nodeIndex*2+1;
                        heap[nodeIndex] = tempHeapValue;
                        nodeIndex = nodeIndex*2+1;
                    }
                    else{
                        // Current node is less than both children - stop reheapify
                        return topItem;
                    }
                }

                // Second child is less than first child
                else{
                    // Second child is less than current node
                    if (nodeComparator(heap[nodeIndex*2+2], heap[nodeIndex])){
                        // Swap current node with second child
                        int tempHeapValue = heap[nodeIndex*2+2];
                        vertexIndices[tempHeapValue] = nodeIndex;
                        heap[nodeIndex*2+2] = heap[nodeIndex];
                        vertexIndices[heap[nodeIndex]] = nodeIndex*2+2;
                        heap[nodeIndex] = tempHeapValue;
                        nodeIndex = nodeIndex*2+2;
                    }
                    else{
                        // Current node is less than both children - stop reheapify
                        return topItem;
                    }
                }
            }

            // Node only has one child
            else{
                // First child is less than current node
                if (nodeComparator(heap[nodeIndex*2+1], heap[nodeIndex])){
                    // Swap current node with first child
                    int tempHeapValue = heap[nodeIndex*2+1];
                    vertexIndices[tempHeapValue] = nodeIndex;
                    heap[nodeIndex*2+1] = heap[nodeIndex];
                    vertexIndices[heap[nodeIndex]] = nodeIndex*2+1;
                    heap[nodeIndex] = tempHeapValue;
                }
                // No more children regardless - stop reheapify
                return topItem;
            }
        }
        return topItem;

    }

    void updateNode(int node){
        // Notifies heap that new shorter route found to node
        // Must sift node upwards
        unsigned int nodeIndex = vertexIndices[node];
        while (nodeIndex > 0){
            unsigned int parentNodeIndex = (nodeIndex-1)/2;

            // Check if current node is less than parent node - swap if case otherwise end procedure
            if (nodeComparator(heap[nodeIndex], heap[parentNodeIndex])){
                int tempHeapValue = heap[nodeIndex];
                vertexIndices[tempHeapValue] = parentNodeIndex;
                vertexIndices[heap[parentNodeIndex]] = nodeIndex;
                heap[nodeIndex] = heap[parentNodeIndex];
                heap[parentNodeIndex] = tempHeapValue;

                nodeIndex = parentNodeIndex;

            }
            else{
                return;
            }

        }
    }

};


vector<string> split(string &s, char delim){
    vector<string> result;
    string current = "";
    for (char c : s){
        if (c==delim){
            result.push_back(current);
            current = "";
        }
        else{
            current += c;
        }
    }
    result.push_back(current);
    return result;
}

pair<double, double> mercator(double lat, double lon) {
    return make_pair((PI * lat * EARTH_RADIUS) / 180,
        EARTH_RADIUS * log(tan(PI * (45 + lon / 2) / 180))
    );
}
double cross(double x1, double y1, double x2, double y2){
    return x1 * y2 - y1 * x2;
}

bool leftTurn(double x1, double y1, double x2, double y2) {
    // Does(x1, y1, 0) x(x2, y2, 0) and checks magnitude
    // Equivalent to checking determinant and seeing whether such a transformation would flip orientation or not
    // No flip orientation->anti-clockwise turn from x1, y1->x2, y2
    return cross(x1, y1, x2, y2) >= 0;
}

double haversineDistance(double lat1deg, double lon1deg, double lat2deg, double lon2deg){
    double lat1rad = lat1deg * PI / 180;
    double lon1rad = lon1deg * PI / 180;
    double lat2rad = lat2deg * PI / 180;
    double lon2rad = lon2deg * PI / 180;

    double term1 = sin((lat2rad - lat1rad)/2) * sin((lat2rad - lat1rad)/2);
    double term2 = cos(lat1rad) * cos(lat2rad) * (sin((lon2rad-lon1rad)/2)*sin((lon2rad-lon1rad)/2));

    return 2 * EARTH_RADIUS * asin(sqrt(term1 + term2));
}


vector<Node> convexHull(vector<Node> nodes) {
    // consider using deque or list instead

    // Can't pass by reference - don't want to modify original vector
    if (nodes.size() <= 3){
        return nodes;
    }

    Node mostBottomLeft = nodes[0];
    unsigned int mostBottomLeftIndex = 0;
    for (unsigned int i = 1; i < nodes.size(); i++) {
        if (nodes[i].y < mostBottomLeft.y
            ||
            (nodes[i].y == mostBottomLeft.y && nodes[i].x < mostBottomLeft.x)
            ) {
            mostBottomLeftIndex = i;
            mostBottomLeft = nodes[i];
        }
    }

    // Swap most bottom left element to front of list
    iter_swap(nodes.begin() + mostBottomLeftIndex, nodes.begin());

    // Create lambda to sort nodes
    // Must be a lambda - c++ does not support functions inside
    // functions, but if function defined outside,
    // can't capture mostBottomLeft to get relative polar angle
    // Partial function application is possible but this uses lambdas anyway
    function<bool(Node&, Node&)> convexHullPolarSort
        = [&mostBottomLeft](Node& nodeA, Node& nodeB) {
        // Custom comparator used to sort nodes for Graham's scan
        // Resolves by polar angle, then sorts by distance from mostBottomLeft



        double crossProduct = cross(nodeA.x-mostBottomLeft.x, nodeA.y-mostBottomLeft.y,
                        nodeB.x-mostBottomLeft.x, nodeB.y-mostBottomLeft.y );

        if (crossProduct>0) {
            // nodeB is left of nodeA
            return true;
        }
        else if (crossProduct < 0) {
            // nodeB is right of nodeA
            return false;
        }
        else {
            // mostBottomLeft, nodeA, nodeB are collinear
            // extremely unlikely due to fp errors
            // so must test separately
            // break ties by increasing distance
            // Could use manhattan distance due to co-linearity
            return pow(nodeA.x - mostBottomLeft.x, 2) +
                pow(nodeA.y - mostBottomLeft.y, 2) <
                pow(nodeB.x - mostBottomLeft.x, 2) +
                pow(nodeB.y - mostBottomLeft.y, 2);
        }
    };

    sort(nodes.begin() + 1, nodes.end(), convexHullPolarSort);

    // Can't use std::stack, since access to top 2 elements required
    // not just the top
    vector<Node> convexHullStack{ mostBottomLeft, nodes[1], nodes[2] };
    // Don't pop elements here - vectors have O(n) pop front - to avoid!


    for (unsigned int i = 3; i < nodes.size(); i++) {
        while (!leftTurn(
            convexHullStack.back().x - (convexHullStack.end() - 2)->x,
            convexHullStack.back().y - (convexHullStack.end() - 2)->y,
            nodes[i].x - convexHullStack.back().x,
            nodes[i].y - convexHullStack.back().y
           )){
            convexHullStack.pop_back();
        }
        convexHullStack.push_back(nodes[i]);

    }

    return convexHullStack;


}

class MapGraphInstance{
private:
    vector<vector<pair<int, double>>> adjacencyList;
    vector<Node> mercatorNodeList;
    vector<double> nodeLats;
    vector<double> nodeLons;
    int nodeCount;
    string region_nodes;
    string nodeLatLons;

    void computeRegionNodes(){
        region_nodes = "[";
        // Get the convex hull of all points to get outer region
        // slightly off due to out poking edges
        for (const Node& outerNode : convexHull(mercatorNodeList)){
            region_nodes += '[' + to_string(outerNode.index) + ']' + ',';
        }
        region_nodes.pop_back();
        region_nodes += ']';
    }

    pair<double, vector<int>> aStarResult(int startNode, int endNode, bool reversedPath=true){
        vector<double> distances(nodeCount, numeric_limits<int>::max());
        vector<int> previousNodes(nodeCount, -1);
        vector<double> heuristicValues(nodeCount, -1);

        // Could use LRU cache here instead, but that would be overkill
        // Don't calculate all heuristics at once
        // 80000 nodes - estimated time of 0.1 to 0.2 s for haversine distance (cPython)
        // 0.03 s (pypy c++)
        // enough to be significant

        function<double(int)> getHeuristicValue = [this, &heuristicValues, endNode](int node){
            if (heuristicValues[node]==-1){
                heuristicValues[node] = haversineDistance(nodeLats[node], nodeLons[node], nodeLats[endNode], nodeLons[endNode]);
            }
            return heuristicValues[node];
        };

        distances[startNode] = 0;
        DijkstraHeap nodeMinHeap(startNode, nodeCount,
         [&distances, &getHeuristicValue](int x, int y){return distances[x] + getHeuristicValue(x) < distances[y] + getHeuristicValue(y);});

        while (nodeMinHeap.size() > 0){
            int currentNode = nodeMinHeap.popTop();
            if (currentNode==endNode){
                break;
            }
            for (const pair<int, double>& connectedNodeWeightPair : adjacencyList[currentNode]){
                if (nodeMinHeap.nodePresent(connectedNodeWeightPair.first)){
                    double newDistance = connectedNodeWeightPair.second + distances[currentNode];
                    if (newDistance < distances[connectedNodeWeightPair.first]){
                        distances[connectedNodeWeightPair.first] = newDistance;
                        previousNodes[connectedNodeWeightPair.first] = currentNode;
                        nodeMinHeap.updateNode(connectedNodeWeightPair.first);
                    }
                }
            }
        }
        int currentNode = endNode;
        vector<int> path;
        while (currentNode!=startNode){
            path.push_back(currentNode);
            currentNode = previousNodes[currentNode];
        }
        path.push_back(startNode);
        if (!reversedPath){
            reverse(path.begin(), path.end());
        }
        return make_pair(distances[endNode], path);

    }

    vector<int> reconstructDijkstraRoute(int endNode, vector<int>& prevNodes, bool reversedPath=true){
        vector<int> result;
        int currentNode = endNode;
        while (prevNodes[currentNode] != -1){
            result.push_back(currentNode);
            currentNode = prevNodes[currentNode];
        }
        result.push_back(currentNode);

        if (!reversedPath){
            reverse(result.begin(), result.end());
        }
        return result;
    }

    pair<vector<double>, vector<int>> dijkstraResult(int startNode){
        vector<double> distances(nodeCount, numeric_limits<int>::max());
        vector<int> previousNodes(nodeCount, -1);

        distances[startNode] = 0;
        DijkstraHeap nodeMinHeap(startNode, nodeCount, [&distances](int x, int y){return distances[x] < distances[y];});

        while (nodeMinHeap.size() > 0){
            int currentNode = nodeMinHeap.popTop();
            for (const pair<int, double>& connectedNodeWeightPair : adjacencyList[currentNode]){
                if (nodeMinHeap.nodePresent(connectedNodeWeightPair.first)){
                    double newDistance = connectedNodeWeightPair.second + distances[currentNode];
                    if (newDistance < distances[connectedNodeWeightPair.first]){
                        distances[connectedNodeWeightPair.first] = newDistance;
                        previousNodes[connectedNodeWeightPair.first] = currentNode;
                        nodeMinHeap.updateNode(connectedNodeWeightPair.first);
                    }
                }
            }

        }
        return make_pair(distances, previousNodes);
    }

    LRUcache<pair<vector<double>, vector<int>>> dijkstraResultCache{[this](int x){return dijkstraResult(x);}};

public:
    MapGraphInstance(string nodeFilename="map_data/nodes.csv", string adjacencyListFilename="map_data/edges.csv"){
        ifstream nodeIn(nodeFilename);
        ifstream edgeIn(adjacencyListFilename);
        string line;

        // Read number of nodes at top of file
        getline(nodeIn, line);
        nodeCount = stoi(line);
        nodeLatLons = "[";

        for (int i = 0; i < nodeCount; i++){
            getline(nodeIn, line);
            vector<string> lineEntries = split(line, ',');

            nodeLatLons += '[' + lineEntries[1] + ',' + lineEntries[2] + "],";
            nodeLats.push_back(stod(lineEntries[1]));
            nodeLons.push_back(stod(lineEntries[2]));

            // Precalculate all mercator projection x,y values for all nodes
            pair<double, double> mercatorXY = mercator(stod(lineEntries[1]), stod(lineEntries[2]));
            mercatorNodeList.push_back(Node(i, mercatorXY.first, mercatorXY.second));
        }
        nodeLatLons.pop_back();
        nodeLatLons += ']';

        for (int i = 0; i < nodeCount; i++){
            vector<pair<int,double>> edges;
            getline(edgeIn, line);
            vector<string> lineEntries = split(line, ',');
            for (unsigned int j = 0; 2 * j + 1 < lineEntries.size(); j++){
                edges.push_back(make_pair(stoi(lineEntries[2*j]), stod(lineEntries[2*j+1])));
            }

            adjacencyList.push_back(edges);
        }

        computeRegionNodes();
    }

    string generate_cycle(int startNode, double targetLength, double distanceTolerance=0.05, double overlapTolerance=0.05, int maxTries=numeric_limits<int>::max()){
        // Dijkstra should hopefully have been recently executed for start node
        pair<vector<double>, vector<int>> computedDijkstra = dijkstraResultCache.getData(startNode);
        vector<double> distances = computedDijkstra.first;
        vector<int> prevNodes = computedDijkstra.second;
        vector<int> possibleNodes;

        for (int node = 0; node < nodeCount; node++){
            // Theoretically start node should have distance > target length
            if (distances[node] > targetLength/4 && distances[node] < (targetLength*2)/3){
                possibleNodes.push_back(node);
            }
        }


        if (possibleNodes.size() < 2){
            return "[0,[]]";
        }
        // Creates a random number generator to generate numbers from 0 to n-1
        uniform_int_distribution<> distrib(0, possibleNodes.size() - 1);
        for (int i = 0; i < maxTries; i++){
            int node1 = possibleNodes[distrib(gen)];
            int node2 = possibleNodes[distrib(gen)];
            if (node1 != node2){//&& distances[node1] + distances[node2] < targetLength){
                // Path is reversed by default - just flip inputs!
                pair<double, vector<int>> secondaryAstar = aStarResult(node2, node1);
                if ( abs(secondaryAstar.first + distances[node1] + distances[node2]  - targetLength)/targetLength < distanceTolerance){
                    // Valid cycle found
                    // Return distance and path
                    vector<int> pathA = reconstructDijkstraRoute(node1, prevNodes, false);
                    vector<int> pathC = reconstructDijkstraRoute(node2, prevNodes);

                    unordered_set<int> usedNodes;
                    int duplicateCount = 0;

                    // following makes sure no overlaps in cycles
                    pathA.pop_back();
                    pathC.pop_back();
                    secondaryAstar.second.pop_back();

                    string result = "[";
                    result += to_string(secondaryAstar.first + distances[node1] + distances[node2]);
                    result += ",[";

                    for (int x : pathA){
                        result += to_string(x) + ',';
                        if (!usedNodes.insert(x).second){
                            duplicateCount++;
                        }
                    }
                    for (int x : secondaryAstar.second){
                        result += to_string(x) + ',';
                        if (!usedNodes.insert(x).second){
                            duplicateCount++;
                        }
                    }
                    for (int x : pathC){
                        result += to_string(x) + ',';
                        if (!usedNodes.insert(x).second){
                            duplicateCount++;
                        }
                    }

                    // Remove trailing comma;
                    result.pop_back();
                    result += "]]";

                    if ( ((double)duplicateCount)/(pathA.size() + secondaryAstar.second.size() + pathC.size()) < overlapTolerance){
                        return result;
                    }
                    overlapTolerance *= 1.1;
                }
                else{
                    distanceTolerance *= 1.1;
                }
            }

        }
        return "[0,[]]";
    }

    string map_dijkstra(int startNode){
        pair<vector<double>, vector<int>> completedDijkstra = dijkstraResultCache.getData(startNode);
        vector<double> distances = completedDijkstra.first;
        vector<int> previousNodes = completedDijkstra.second;

        string result = "[[" + to_string(distances[0]);
        for (unsigned int i = 1; i < distances.size(); i++){
            result+= ','+to_string(distances[i]);
        }
        result+="],[" + to_string(previousNodes[0]);
        for (unsigned int i = 1; i < previousNodes.size(); i++){
            result+= ','+to_string(previousNodes[i]);
        }

        result += "]]";
        return result;

    }    

    string convex_hull_partition(int startNode, double partitionDistance=2000){
        vector<double> dijkstraDistance = dijkstraResultCache.getData(startNode).first;
        vector<vector<Node>> partitionedNodes {vector<Node>{}};
        unsigned int largestSetNum = 0;
        for (unsigned int i = 0; i < dijkstraDistance.size(); i++){
            unsigned int nodeSetIndex = floor(dijkstraDistance[i] / partitionDistance);
            if (nodeSetIndex > largestSetNum){
                for (unsigned int j = 0; j < nodeSetIndex - largestSetNum; j++){
                    partitionedNodes.push_back(vector<Node>{});
                }
                largestSetNum = nodeSetIndex;
            }
            partitionedNodes[nodeSetIndex].push_back(mercatorNodeList[i]);
        }

        // vector merging - might be better to use linked lists if convex hulls get very large
        vector<vector<Node>> convexHulls;
        convexHulls.push_back(convexHull(partitionedNodes[0]));

        for (unsigned int i = 1; i < partitionedNodes.size(); i++){
            partitionedNodes[i].insert(partitionedNodes[i].end(), convexHulls[i-1].begin(), convexHulls[i-1].end());
            convexHulls.push_back(convexHull(partitionedNodes[i]));
        }
        string result = "[";
        for (const vector<Node>& partitionConvexHull : convexHulls){
            result += '[';
            result += to_string(partitionConvexHull[0].index);
            for (unsigned int i = 1; i < partitionConvexHull.size(); i++){
                result += ',';
                result += to_string(partitionConvexHull[i].index);
            }
            result += "],";
        }
        // Remove extra comma at end
        result.pop_back();
        result += ']';
        return result;
    }
    string get_node_lat_lons(){
        return nodeLatLons;
    }
    string get_region_nodes(){
        return region_nodes;
    }
};




PYBIND11_MODULE(graph_algorithms, m) {
     py::class_<MapGraphInstance>(m, "MapGraphInstance")
         .def(py::init<string, string>(),
            py::arg("node_filename") = "map_data/nodes.csv",
            py::arg("adjacency_list_filename") = "map_data/edges.csv"
        )   
        .def("map_dijkstra", &MapGraphInstance::map_dijkstra,
            py::arg("start_node"))
        .def("convex_hull_partition", &MapGraphInstance::convex_hull_partition,
            py::arg("start_node"),
            py::arg("partition_distance")=2000)
        .def("get_region_nodes", &MapGraphInstance::get_region_nodes)
        .def("get_node_lat_lons", &MapGraphInstance::get_node_lat_lons)
        .def("generate_cycle", &MapGraphInstance::generate_cycle,
            py::arg("start_node"),
            py::arg("target_length"),
            py::arg("distance_tolerance")=0.05,
            py::arg("overlap_tolerance")=0.05,
            py::arg("max_tries")=numeric_limits<int>::max());

}

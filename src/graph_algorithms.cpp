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
// "A Mersenne Twister pseudo-random generator of 32-bit numbers with a state size of 19937 bits"
random_device rd;  // a seed source for the random number engine
mt19937 gen(rd()); // mersenne_twister_engine seeded with rd()

struct Edge{
    int endIndex;
    double distance;
    Edge (int endIndex, double distance):
        endIndex(endIndex),
        distance(distance){}
};

struct Node {
    int index;
    double x, y;
    Node(int index, double x, double y):
        index(index),
        x(x),
        y(y)
    {}
};

struct aStarResultObject{
    double distance;
    double subsidiaryDistance;
    vector<int> path;
    vector<double> distancesAlongPath;
    vector<double> subsidiaryDistancesAlongPath;
    aStarResultObject(double distance,
                      double subsidiaryDistance,
                      vector<int> path,
                      vector<double> distancesAlongPath,
                      vector<double> subsidiaryDistancesAlongPath):
            distance(distance),
            subsidiaryDistance(subsidiaryDistance),
            path(path),
            distancesAlongPath(distancesAlongPath),
            subsidiaryDistancesAlongPath(subsidiaryDistancesAlongPath)
    {}
    aStarResultObject(){}
};

// A Generic LRU cache that takes integers as inputs, with automatic data generation when cache miss occurs
template <class T>
class LRUcache{
private:
    unordered_map<int, T> cachedData;
    unordered_map<int, list<int>::iterator> locationOfInputsInLRUInputs;
    list<int> LRUInputs;
    function<T(int)> targetFunction;
    unsigned int maxSize;
    void storeDataWithoutCacheHitChecks(int x, T& data){
        cachedData[x] = data;
        LRUInputs.push_back(x);
        locationOfInputsInLRUInputs[x] = prev(LRUInputs.end());
        if (LRUInputs.size() > maxSize){
            int erasingInput = LRUInputs.front();
            cachedData.erase(erasingInput);
            locationOfInputsInLRUInputs.erase(erasingInput);
            LRUInputs.pop_front();
        }
    }
    void cacheHit(int x){
        LRUInputs.erase(locationOfInputsInLRUInputs[x]);
        LRUInputs.push_back(x);
        locationOfInputsInLRUInputs[x] = prev(LRUInputs.end());
    }
public:
    // Cache initialises with function to run if cache miss occurs
    LRUcache(function<T(int)> targetFunction, unsigned int maxSize = 100):
        targetFunction(targetFunction),
        maxSize(maxSize)
        {}

    void storeData(int x, T& data){
        if (cachedData.count(x)){
            cacheHit(x);
        }
        else{
            storeDataWithoutCacheHitChecks(x, data);
        }
    }
    T getData(int x){
        if (cachedData.count(x)){
            cacheHit(x);
            return cachedData[x];
        }
        else{
            T result = targetFunction(x);
            storeDataWithoutCacheHitChecks(x, result);
            return result;
        }
    }
};

template <class T, class IndexTracker>
class IndexedPriorityQueue{
private:
    vector<T> heap;
    function<bool(T, T)> itemComparator;
    IndexTracker itemIndices;
public:
    unsigned int size(){
        // Get the size of the heap
        return heap.size();
    }

    IndexedPriorityQueue(function<bool(T, T)> itemComparator):
        itemComparator(itemComparator){}
    IndexedPriorityQueue(function<bool(T, T)> itemComparator, IndexTracker indexTracker):
        itemComparator(itemComparator),
        itemIndices(indexTracker){}

    bool itemPresent(T item, bool itemExistenceCheck=true){
        // itemExistenceCheck should allow inlining by compiler such that bounds checking can be avoided if the
        // item is known to have previously been processed.
        if (itemExistenceCheck){
            try {
                return itemIndices.at(item) != -1;
            }
            catch (const std::out_of_range&) {
                return false;
            }
        }
        else{
            return itemIndices[item] != -1;
        }

    }
    T peekTop(){
        return heap[0];
    }
    T popTop(){
        T topItem = peekTop();
        itemIndices[heap.back()] = 0;
        itemIndices[topItem] = -1;
        heap[0] = heap.back();
        heap.pop_back();
        unsigned int itemIndex = 0;

        // Loop until current item has no children
        while (itemIndex * 2 + 1 < heap.size()){
            // Check if current item has a second child
            if (itemIndex * 2 + 2 < heap.size()){
                // First child is less than second child
                if (itemComparator(heap[itemIndex*2+1], heap[itemIndex*2 + 2])){
                    // First child is less than current item
                    if (itemComparator(heap[itemIndex*2+1], heap[itemIndex])){
                        // Swap current item with first child
                        int tempHeapValue = heap[itemIndex*2+1];
                        itemIndices[tempHeapValue] = itemIndex;
                        heap[itemIndex*2+1] = heap[itemIndex];
                        itemIndices[heap[itemIndex]] = itemIndex*2+1;
                        heap[itemIndex] = tempHeapValue;
                        itemIndex = itemIndex*2+1;
                    }
                    else{
                        // Current item is less than both children - stop reheapify
                        return topItem;
                    }
                }
                // Second child is less than first child
                else{
                    // Second child is less than current item
                    if (itemComparator(heap[itemIndex*2+2], heap[itemIndex])){
                        // Swap current item with second child
                        int tempHeapValue = heap[itemIndex*2+2];
                        itemIndices[tempHeapValue] = itemIndex;
                        heap[itemIndex*2+2] = heap[itemIndex];
                        itemIndices[heap[itemIndex]] = itemIndex*2+2;
                        heap[itemIndex] = tempHeapValue;
                        itemIndex = itemIndex*2+2;
                    }
                    else{
                        // Current item is less than both children - stop reheapify
                        return topItem;
                    }
                }
            }
            // Item only has one child
            else{
                // First child is less than current item
                if (itemComparator(heap[itemIndex*2+1], heap[itemIndex])){
                    // Swap current item with first child
                    int tempHeapValue = heap[itemIndex*2+1];
                    itemIndices[tempHeapValue] = itemIndex;
                    heap[itemIndex*2+1] = heap[itemIndex];
                    itemIndices[heap[itemIndex]] = itemIndex*2+1;
                    heap[itemIndex] = tempHeapValue;
                }
                // No more children regardless - stop reheapify
                return topItem;
            }
        }
        return topItem;
    }
    void reduceItem(T item){
        unsigned int itemIndex = itemIndices[item];
        while (itemIndex > 0){
            unsigned int parentItemIndex = (itemIndex-1)/2;
            // Check if current node is less than parent node - swap if case otherwise end procedure
            if (itemComparator(heap[itemIndex], heap[parentItemIndex])){
                int tempHeapValue = heap[itemIndex];
                itemIndices[tempHeapValue] = parentItemIndex;
                itemIndices[heap[parentItemIndex]] = itemIndex;
                heap[itemIndex] = heap[parentItemIndex];
                heap[parentItemIndex] = tempHeapValue;
                itemIndex = parentItemIndex;
            }
            else{
                return;
            }
        }
    }
    void insertItem(T item){
        itemIndices[item] = heap.size();
        heap.push_back(item);
        reduceItem(item);
    }
};


class DijkstraHeap{
private:
    IndexedPriorityQueue<int, vector<int>> priorityQueue;
public:
    unsigned int size(){
        return priorityQueue.size();
    }
    // nodeComparator - a function taking in two integers (nodeA, nodeB) and returns True if the current shortest path
    //      to nodeA from startNode is less than the current shortest path to nodeB from startNode, or False otherwise
    DijkstraHeap(int nodeCount, function<bool(int, int)> nodeComparator)
    : priorityQueue(IndexedPriorityQueue<int, vector<int>>(nodeComparator, vector<int>(nodeCount)))
    {
        for (int i = 0; i < nodeCount; i++) {
            // Insert nodes 0 to n - 1 to ensure vector<int> tracking node indices is not indexed out of bounds
            // Not particularly performance affecting since all nodes will need to be eventually added anyway
            priorityQueue.insertItem(i);
        }
    }
    bool nodePresent(int node){
        // We know all nodes have been processed at least once so itemExistenceCheck is not needed
        return priorityQueue.itemPresent(node, false);
    }
    int peekTop(){
        return priorityQueue.peekTop();
    }
    int popTop(){
        return priorityQueue.popTop();
    }
    void updateNode(int node) {
        priorityQueue.reduceItem(node);
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
    if (nodes.size() <= 3){
        return nodes;
    }
    Node mostBottomLeft = nodes[0];
    unsigned int mostBottomLeftIndex = 0;
    for (unsigned int i = 1; i < nodes.size(); i++) {
        if (nodes[i].y < mostBottomLeft.y || (nodes[i].y == mostBottomLeft.y && nodes[i].x < mostBottomLeft.x)) {
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
            // break ties by increasing distance
            // Could use manhattan distance due to co-linearity
            return pow(nodeA.x - mostBottomLeft.x, 2) +
                pow(nodeA.y - mostBottomLeft.y, 2) <
                pow(nodeB.x - mostBottomLeft.x, 2) +
                pow(nodeB.y - mostBottomLeft.y, 2);
        }
    };

    // Don't pop elements here - vectors have O(n) pop front - to avoid!
    sort(nodes.begin() + 1, nodes.end(), convexHullPolarSort);

    // Can't use std::stack, since access to top 2 elements required
    vector<Node> convexHullStack{ mostBottomLeft, nodes[1], nodes[2] };
    for (unsigned int i = 3; i < nodes.size(); i++) {
        while (!leftTurn(
            convexHullStack.back().x - (convexHullStack.end() - 2)->x,
            convexHullStack.back().y - (convexHullStack.end() - 2)->y,
            nodes[i].x - convexHullStack.back().x,
            nodes[i].y - convexHullStack.back().y))
        {
            convexHullStack.pop_back();
        }
        convexHullStack.push_back(nodes[i]);
    }
    return convexHullStack;
}

pair<vector<double>, vector<int>> dijkstraResult(int startNode, vector<vector<Edge>>& adjacencyList){
    vector<double> distances(adjacencyList.size(), numeric_limits<int>::max());
    vector<int> previousNodes(adjacencyList.size(), -1);

    distances[startNode] = 0;
    DijkstraHeap nodeMinHeap(adjacencyList.size(), [&distances](int x, int y){return distances[x] < distances[y];});

    while (nodeMinHeap.size() > 0){
        int currentNode = nodeMinHeap.popTop();
        for (const Edge& edge : adjacencyList[currentNode]){
            if (nodeMinHeap.nodePresent(edge.endIndex)){
                double newDistance = edge.distance + distances[currentNode];
                if (newDistance < distances[edge.endIndex]){
                    distances[edge.endIndex] = newDistance;
                    previousNodes[edge.endIndex] = currentNode;
                    nodeMinHeap.updateNode(edge.endIndex);
                }
            }
        }
    }
    return make_pair(distances, previousNodes);
}

aStarResultObject aStarResult(int startNode,
                              int endNode,
                              vector<vector<Edge>>& adjacencyList,
                              vector<vector<Edge>>& subsidiaryAdjacencyList,
                              function<double(int, int)> heuristicFunction,
                              bool reversedPath=true){
    unordered_map<int, double> distances;
    unordered_map<int, double> subsidiaryDistances;
    unordered_map<int, int> previousNodes;
    distances[startNode] = 0;
    subsidiaryDistances[startNode] = 0;

    IndexedPriorityQueue<int, unordered_map<int, int>> nodeMinHeap(
            [&distances, &heuristicFunction, endNode](int x, int y){return distances[x] + heuristicFunction(x, endNode) < distances[y] + heuristicFunction(y, endNode);});

    unordered_set<int> visitedNodes;
    visitedNodes.insert(startNode);
    nodeMinHeap.insertItem(startNode);
    while (nodeMinHeap.size() > 0){
        int currentNode = nodeMinHeap.popTop();
        if (currentNode==endNode){
            break;
        }
        for (unsigned int i = 0; i < adjacencyList[currentNode].size(); i++){
            Edge edge = adjacencyList[currentNode][i];
            Edge subsidiaryEdge = subsidiaryAdjacencyList[currentNode][i];
            if (visitedNodes.count(edge.endIndex)){
                if (nodeMinHeap.itemPresent(edge.endIndex)){
                    double newDistance = edge.distance + distances[currentNode];
                    if (newDistance < distances[edge.endIndex]){
                        distances[edge.endIndex] = newDistance;
                        previousNodes[edge.endIndex] = currentNode;
                        nodeMinHeap.reduceItem(edge.endIndex);
                        // Overwrite subsidiary distances regardless of whether it is optimal or not
                        // We are only interested in optimising for distance
                        subsidiaryDistances[edge.endIndex] = subsidiaryEdge.distance + subsidiaryDistances[currentNode];
                    }
                }
            }
            else{
                visitedNodes.insert(edge.endIndex);
                distances[edge.endIndex] = edge.distance + distances[currentNode];
                subsidiaryDistances[edge.endIndex] = subsidiaryEdge.distance + subsidiaryDistances[currentNode];
                previousNodes[edge.endIndex] = currentNode;
                nodeMinHeap.insertItem(edge.endIndex);
            }
        }
    }
    int currentNode = endNode;
    vector<int> path;
    vector<double> distancesAlongPath;
    vector<double> subsidiaryDistancesAlongPath;
    while (currentNode!=startNode){
        path.push_back(currentNode);
        distancesAlongPath.push_back(distances[currentNode]);
        subsidiaryDistancesAlongPath.push_back(subsidiaryDistances[currentNode]);
        currentNode = previousNodes[currentNode];
    }
    path.push_back(startNode);
    distancesAlongPath.push_back(0);
    subsidiaryDistancesAlongPath.push_back(0);
    if (!reversedPath){
        reverse(path.begin(), path.end());
        reverse(distancesAlongPath.begin(), distancesAlongPath.end());
        reverse(subsidiaryDistancesAlongPath.begin(), subsidiaryDistancesAlongPath.end());
    }
    return aStarResultObject(distances[endNode], subsidiaryDistances[endNode], path, distancesAlongPath, subsidiaryDistancesAlongPath);
}

class MapGraphInstance{
private:
    vector<vector<Edge>> distanceAdjacencyList;
    vector<vector<Edge>> timeAdjacencyList;
    vector<Node> mercatorNodeList;
    vector<double> nodeLats;
    vector<double> nodeLons;
    vector<double> nodeElevations;
    int nodeCount;
    string region_nodes;
    string nodeLatLons;
    string nodeElevationString;

    void computeRegionNodes(){
        region_nodes = "[";
        // Get the convex hull of all points to get outer region
        for (const Node& outerNode : convexHull(mercatorNodeList)){
            region_nodes += '[' + to_string(outerNode.index) + ']' + ',';
        }
        region_nodes.pop_back();
        region_nodes += ']';
    }

    double walkingTime(int startNode, int endNode){
        double distance = haversineDistance(nodeLats[startNode], nodeLons[startNode], nodeLats[endNode], nodeLons[endNode]);
        double slope = (nodeElevations[endNode]-nodeElevations[startNode])/distance;
        double speed = 6*(exp(-3.5*abs(slope + 0.05))) / 3.6;
        return distance/speed;
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
    LRUcache<pair<vector<double>, vector<int>>> dijkstraResultCache{[this](int x){return dijkstraResult(x, distanceAdjacencyList);}};
public:
    MapGraphInstance(string nodeFilename="map_data/nodes.csv",
                     string adjacencyListFilename="map_data/edges.csv",
                     string elevationListFilename="map_data/elevation.csv"){
        ifstream nodeIn(nodeFilename);
        ifstream edgeIn(adjacencyListFilename);
        ifstream elevationIn(elevationListFilename);
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
            distanceAdjacencyList.push_back(vector<Edge>());
            timeAdjacencyList.push_back(vector<Edge>());
        }
        for (int i = 0; i < nodeCount; i++){
            getline(edgeIn, line);
            vector<string> lineEntries = split(line, ',');
            for (unsigned int j = 0; 3 * j + 2 < lineEntries.size(); j++){
                distanceAdjacencyList[i].push_back(Edge(stoi(lineEntries[3*j]), stod(lineEntries[3*j+1])));
                timeAdjacencyList[i].push_back(Edge(stoi(lineEntries[3*j]), stod(lineEntries[3*j+2])));
            }
        }
        nodeElevationString = "[";
        getline(elevationIn, line);
        nodeElevationString += line;
        nodeElevationString += ']';
        vector<string> lineEntries = split(line, ',');
        for (string s : lineEntries){
            nodeElevations.push_back(stod(s));
        }
        computeRegionNodes();
    }

    string generate_cycle(int startNode, double targetLength, double distanceTolerance=0.05, double overlapTolerance=0.05, int maxTries=numeric_limits<int>::max()){
        // Dijkstra should hopefully have been recently executed for start node
        // Note dijkstra is not that computationally expensive - the main problem is delivering the results
        pair<vector<double>, vector<int>> computedDijkstra = dijkstraResultCache.getData(startNode);
        vector<double> distances = computedDijkstra.first;
        vector<int> prevNodes = computedDijkstra.second;
        vector<int> possibleNodes;
        for (int node = 0; node < nodeCount; node++){
            if (distances[node] > targetLength/6 && distances[node] < (targetLength)/3){
                possibleNodes.push_back(node);
            }
        }
        if (possibleNodes.size() < 2){
            return "[0,0]";
        }
        // Creates a random number generator to generate numbers from 0 to n-1
        uniform_int_distribution<> distrib(0, possibleNodes.size() - 1);
        for (int i = 0; i < maxTries; i++){
            int node1 = possibleNodes[distrib(gen)];
            int node2 = possibleNodes[distrib(gen)];
            if (node1 != node2){
                aStarResultObject secondaryAstar = aStarResult(node2,
                                                                node1,
                                                                distanceAdjacencyList,
                                                                timeAdjacencyList,
                                                                [this](int node, int endNode){
                    return haversineDistance(nodeLats[node], nodeLons[node], nodeLats[endNode], nodeLons[endNode]);
                    });
                double distance = secondaryAstar.distance;
                vector<int> route = secondaryAstar.path;
                if ( abs(distance + distances[node1] + distances[node2]  - targetLength)/targetLength < distanceTolerance){
                    // Valid cycle found
                    // Return distance and path
                    vector<int> pathA = reconstructDijkstraRoute(node1, prevNodes, false);
                    vector<int> pathC = reconstructDijkstraRoute(node2, prevNodes);
                    unordered_set<int> usedNodes;
                    int duplicateCount = 0;

                    // following makes sure no overlaps in cycles
                    pathA.pop_back();
                    pathC.pop_back();
                    route.pop_back();

                    string result = "[";
                    result += to_string(node1) + ',' + to_string(node2) + ']';
                    for (int x : pathA){
                        if (!usedNodes.insert(x).second){
                            duplicateCount++;
                        }
                    }
                    for (int x : route){
                        if (!usedNodes.insert(x).second){
                            duplicateCount++;
                        }
                    }
                    for (int x : pathC){
                        if (!usedNodes.insert(x).second){
                            duplicateCount++;
                        }
                    }
                    if ( ((double)duplicateCount)/(pathA.size() + route.size() + pathC.size()) < overlapTolerance){
                        return result;
                    }
                    overlapTolerance *= 1.1;
                }
                else{
                    distanceTolerance *= 1.1;
                }
            }

        }
        return "[0,0]";
    }

    string a_star(int startNode, int endNode, bool useTime){
        aStarResultObject completedAstar;
        string result = "[";
        if (useTime) {
            completedAstar = aStarResult(startNode,
                                         endNode,
                                         timeAdjacencyList,
                                         distanceAdjacencyList,
                                         [this](int node, int endNode){
                                             return walkingTime(node, endNode);
                                         },
                                         false
                                         );
            // Output of distance, time is flipped in a star if time is seen as metric to be optimised
            result += to_string(completedAstar.subsidiaryDistance) + "," + to_string(completedAstar.distance) + ",[";
        }
        else{
            completedAstar = aStarResult(startNode,
                                         endNode,
                                         distanceAdjacencyList,
                                         timeAdjacencyList,
                                         [this](int node, int endNode){
                                             return haversineDistance(nodeLats[node], nodeLons[node], nodeLats[endNode], nodeLons[endNode]);
                                         },
                                         false
                                         );
            result += to_string(completedAstar.distance) + "," + to_string(completedAstar.subsidiaryDistance) + ",[";
        }
        for (int node : completedAstar.path){
            result += to_string(node) + ',';
        }
        result.pop_back();
        result += "],[";

        // Record all distances in route for purposes of elevation graph
        if (useTime){
            for (double node_distance : completedAstar.subsidiaryDistancesAlongPath){
                result += to_string(node_distance) + ',';
            }
        }
        else{
            for (double node_distance : completedAstar.distancesAlongPath){
                result += to_string(node_distance) + ',';
            }
        }
        result.pop_back();
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
    string get_node_elevations(){
        return nodeElevationString;
    }
};

PYBIND11_MODULE(graph_algorithms, m) {
     py::class_<MapGraphInstance>(m, "MapGraphInstance")
         .def(py::init<string, string>(),
            py::arg("node_filename") = "map_data/nodes.csv",
            py::arg("adjacency_list_filename") = "map_data/edges.csv"
        )
        .def("convex_hull_partition", &MapGraphInstance::convex_hull_partition,
            py::arg("start_node"),
            py::arg("partition_distance")=2000)
        .def("get_region_nodes", &MapGraphInstance::get_region_nodes)
        .def("get_node_lat_lons", &MapGraphInstance::get_node_lat_lons)
        .def("get_node_elevations", &MapGraphInstance::get_node_elevations)
        .def("generate_cycle", &MapGraphInstance::generate_cycle,
            py::arg("start_node"),
            py::arg("target_length"),
            py::arg("distance_tolerance")=0.05,
            py::arg("overlap_tolerance")=0.05,
            py::arg("max_tries")=numeric_limits<int>::max())
        .def("a_star", &MapGraphInstance::a_star,
             py::arg("start_node"),
             py::arg("end_node"),
             py::arg("use_time"));
}

#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <string>
#include <memory>
#include <unordered_set>
#include <vector>
#include <fstream>
#include <cmath>
#include <list>
#include <limits>
#include <algorithm>
#include <unordered_map>
#include <random>
#include <future>
#include <numeric>

namespace py = pybind11;
using namespace std;

// use constexpr to define constants
constexpr int EARTH_RADIUS = 6378137;
constexpr double PI = 3.14159265358979323846;

random_device rd;
mt19937 gen(rd());

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

enum Direction{
    Top,
    Bottom,
    Left,
    Right
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
            path(std::move(path)),
            distancesAlongPath(std::move(distancesAlongPath)),
            subsidiaryDistancesAlongPath(std::move(subsidiaryDistancesAlongPath))
    {}
    aStarResultObject()= default;
};

// A Generic LRU cache that takes integers as inputs, with automatic data generation when cache miss occurs
template <class T1, class T2>
class LRUcache{
private:
    unordered_map<T1, T2> cachedData;
    // https://stackoverflow.com/questions/11275444/c-template-typename-iterator - why typename is necessary
    unordered_map<T1, typename list<T1>::iterator> locationOfInputsInLRUInputs;
    list<T1> LRUInputs;
    function<T2(T1)> targetFunction;
    unsigned int maxSize;
    void storeDataWithoutCacheHitChecks(T1 x, T2& data){
        cachedData[x] = data;
        LRUInputs.push_back(x);
        locationOfInputsInLRUInputs[x] = prev(LRUInputs.end());
        if (LRUInputs.size() > maxSize){
            T1 erasingInput = LRUInputs.front();
            cachedData.erase(erasingInput);
            locationOfInputsInLRUInputs.erase(erasingInput);
            LRUInputs.pop_front();
        }
    }
    void cacheHit(T1 x){
        LRUInputs.erase(locationOfInputsInLRUInputs[x]);
        LRUInputs.push_back(x);
        locationOfInputsInLRUInputs[x] = prev(LRUInputs.end());
    }
public:
    // Cache initialises with function to run if cache miss occurs
    explicit LRUcache(function<T2(T1)> targetFunction, unsigned int maxSize = 100):
            targetFunction(std::move(targetFunction)),
            maxSize(maxSize)
    {}

    T2 getData(T1 x){
        if (cachedData.count(x)){
            cacheHit(x);
            return cachedData[x];
        }
        else{
            T2 result = targetFunction(x);
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
        return heap.size();
    }

    explicit IndexedPriorityQueue(function<bool(T, T)> itemComparator):
            itemComparator(std::move(itemComparator)){}
    IndexedPriorityQueue(function<bool(T, T)> itemComparator, IndexTracker indexTracker):
            itemComparator(std::move(itemComparator)),
            itemIndices(std::move(indexTracker)){}

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
    DijkstraHeap(unsigned int nodeCount, function<bool(int, int)> nodeComparator)
            : priorityQueue(IndexedPriorityQueue<int, vector<int>>(std::move(nodeComparator), vector<int>(nodeCount)))
    {
        for (unsigned int i = 0; i < nodeCount; i++) {
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

vector<string> split(const string& s, char delim){
    vector<string> result;
    string current;
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
    // Adapted from https://wiki.openstreetmap.org/wiki/Mercator#C
    return make_pair(EARTH_RADIUS*PI*lon/180,
                     log(tan( (PI*lat/180) / 2 + PI/4 )) * EARTH_RADIUS
    );
}

pair<double, double> inverseMercator(double x, double y){
    // Adapted from https://wiki.openstreetmap.org/wiki/Mercator#C
    return make_pair(180*(2 * atan(exp( y/EARTH_RADIUS)))/PI - 90,
                     (180 * x / PI)/EARTH_RADIUS);
}

double cross(double x1, double y1, double x2, double y2){
    return x1 * y2 - y1 * x2;
}

bool leftTurn(double x1, double y1, double x2, double y2) {
    // Does(x1, y1, 0) x(x2, y2, 0) and checks magnitude of z coordinate
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
    // Note we can't just use closest node to bottom left
    // such as in this scenario:
    // - - - 
    // x - - 
    // - - x
    Node mostBottomLeft = nodes[0];
    unsigned int mostBottomLeftIndex = 0;
    for (unsigned int i = 1; i < nodes.size(); i++) {
        if (nodes[i].y < mostBottomLeft.y || (nodes[i].y == mostBottomLeft.y && nodes[i].x < mostBottomLeft.x)) {
            mostBottomLeftIndex = i;
            mostBottomLeft = nodes[i];
        }
    }
    // Swap most bottom left element to front of list
    swap(nodes[mostBottomLeftIndex], nodes[0]);

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
                    // Can use manhattan distance due to co-linearity
                    return abs(nodeA.x - mostBottomLeft.x) + abs(nodeA.y - mostBottomLeft.y) <
                           abs(nodeB.x - mostBottomLeft.x) + abs(nodeB.y - mostBottomLeft.y);
                }
            };

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

pair<vector<double>, vector<int>> dijkstraResult(int startNode, const vector<vector<Edge>>& adjacencyList){
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
                              const vector<vector<Edge>>& adjacencyList,
                              const vector<vector<Edge>>& subsidiaryAdjacencyList,
                              function<double(int, int)> heuristicFunction){

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
                previousNodes[edge.endIndex] = currentNode;
                subsidiaryDistances[edge.endIndex] = subsidiaryEdge.distance + subsidiaryDistances[currentNode];
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

    reverse(path.begin(), path.end());
    reverse(distancesAlongPath.begin(), distancesAlongPath.end());
    reverse(subsidiaryDistancesAlongPath.begin(), subsidiaryDistancesAlongPath.end());
    return {distances[endNode], subsidiaryDistances[endNode], path, distancesAlongPath, subsidiaryDistancesAlongPath};
}

string interpolatedLatLon(double x1, double y1, double x2, double y2, double value1, double value2, double isovalue){
    // Presume value2!=value1
    double x = x1 + (x2-x1)*(isovalue-value1)/(value2-value1);
    double y = y1 + (y2-y1)*(isovalue-value1)/(value2-value1);
    pair<double, double> posDeg = inverseMercator(x, y);
    return '[' + to_string(posDeg.first) + ',' + to_string(posDeg.second) + ']';
}

void findSubisoline(double gridDistance,
                    double absoluteMinX,
                    double absoluteMinY,
                    double minX,
                    double maxX,
                    double minY,
                    double maxY,
                    double isovalue,
                    const vector<double>& distances,
                    const vector<vector<int>>& closestNodes,
                    string& totalResult,
                    mutex& m){
    string result;

    if (minY != absoluteMinY){
        // Allows the sampling of rows inbetween regions!
        minY -= gridDistance;
    }

    // Floating point addition is fine as we are only dealing with integers/half integers
    for (double y = minY + gridDistance/2; y <= maxY - gridDistance/2; y+=gridDistance){
        for (double x = minX + gridDistance/2; x <= maxX - gridDistance/2; x+=gridDistance){
            double topLeftValue =
                    distances[
                            closestNodes[static_cast<long long>(round((y - gridDistance/2 - absoluteMinY)/gridDistance))]
                            [static_cast<long long>(round((x - gridDistance/2 - absoluteMinX)/gridDistance))]
                    ];
            double topRightValue =
                    distances[
                            closestNodes[static_cast<long long>(round((y - gridDistance/2 - absoluteMinY)/gridDistance))]
                            [static_cast<long long>(round((x + gridDistance/2 - absoluteMinX)/gridDistance))]
                    ];
            double bottomLeftValue =
                    distances[
                            closestNodes[static_cast<long long>(round((y + gridDistance/2 - absoluteMinY)/gridDistance))]
                            [static_cast<long long>(round((x - gridDistance/2 - absoluteMinX)/gridDistance))]
                    ];
            double bottomRightValue =
                    distances[
                            closestNodes[static_cast<long long>(round((y + gridDistance/2 - absoluteMinY)/gridDistance))]
                            [static_cast<long long>(round((x + gridDistance/2 - absoluteMinX)/gridDistance))]
                    ];
            // gives each of 16 cases a unique number
            // 1001 would indicate topLeft is above isovalue, topRight below, bottomLeft below, bottomRight above
            int caseIndex = ((topLeftValue>=isovalue)<<3) + ((topRightValue>=isovalue)<<2)
                            + ((bottomLeftValue>=isovalue)<<1) + ((bottomRightValue>=isovalue));

            // gridDistance=gridDistance allows property of current object to be specifically captured by lambda
            // https://stackoverflow.com/questions/7895879/using-data-member-in-lambda-capture-list-inside-a-member-function
            function<string(Direction)> getContourPoint
                    = [x, y, gridDistance=gridDistance, topLeftValue, topRightValue, bottomLeftValue, bottomRightValue, isovalue](Direction d){
                switch(d){
                    case Top:
                        return interpolatedLatLon(x-gridDistance/2,
                                                  y-gridDistance/2,
                                                  x+gridDistance/2,
                                                  y-gridDistance/2,
                                                  topLeftValue,
                                                  topRightValue,
                                                  isovalue);
                    case Bottom:
                        return interpolatedLatLon(x-gridDistance/2,
                                                  y+gridDistance/2,
                                                  x+gridDistance/2,
                                                  y+gridDistance/2,
                                                  bottomLeftValue,
                                                  bottomRightValue,
                                                  isovalue);
                    case Left:
                        return interpolatedLatLon(x-gridDistance/2,
                                                  y-gridDistance/2,
                                                  x-gridDistance/2,
                                                  y+gridDistance/2,
                                                  topLeftValue,
                                                  bottomLeftValue,
                                                  isovalue);

                    case Right:
                        return interpolatedLatLon(x+gridDistance/2,
                                                  y-gridDistance/2,
                                                  x+gridDistance/2,
                                                  y+gridDistance/2,
                                                  topRightValue,
                                                  bottomRightValue,
                                                  isovalue);
                    default:
                        return string("");
                }

            };
            double average;
            switch (caseIndex){
                case 15: case 0:
                    // All on/off
                    break;
                case 1:
                    // Low Low
                    // Low High
                case 14:
                    // High High
                    // High Low
                    result += '[' + getContourPoint(Bottom) + ',' + getContourPoint(Right) + "],";
                    break;
                case 2:
                    // Low Low
                    // High Low
                case 13:
                    // High High
                    // Low High
                    result += '[' + getContourPoint(Bottom) + ',' + getContourPoint(Left) + "],";
                    break;
                case 3:
                    // Low Low
                    // High High
                case 12:
                    // High High
                    // Low Low
                    result += '[' + getContourPoint(Left) + ',' + getContourPoint(Right) + "],";
                    break;
                case 4:
                    // Low High
                    // Low Low
                case 11:
                    // High Low
                    // High High
                    result += '[' + getContourPoint(Top) + ',' + getContourPoint(Right) + "],";
                    break;
                case 5:
                    // Low High
                    // Low High
                case 10:
                    // High Low
                    // High Low
                    result += '['+ getContourPoint(Bottom) + ',' + getContourPoint(Top) + "],";
                    break;
                case 6:
                    // Low High
                    // High Low
                    // Saddle point
                    average = (bottomRightValue + bottomLeftValue + topRightValue + topLeftValue)/4;
                    if (average>=isovalue){
                        result += '['+ getContourPoint(Top) + ',' + getContourPoint(Left) + "],";
                        result += '['+ getContourPoint(Bottom) + ',' + getContourPoint(Right) + "],";
                    }
                    else{
                        result += '['+ getContourPoint(Top) + ',' + getContourPoint(Right) + "],";
                        result += '['+ getContourPoint(Bottom) + ',' + getContourPoint(Left) + "],";

                    }
                    break;
                case 7:
                    // Low High
                    // High High
                case 8:
                    // High Low
                    // Low Low
                    result += '['+ getContourPoint(Left) + ',' + getContourPoint(Top) + "],";
                    break;
                case 9:
                    // High Low
                    // Low High
                    // Saddle point
                    average = (bottomRightValue + bottomLeftValue + topRightValue + topLeftValue)/4;
                    if (average>=isovalue){
                        result += '['+ getContourPoint(Top) + ',' + getContourPoint(Right) + "],";
                        result += '['+ getContourPoint(Bottom) + ',' + getContourPoint(Left) + "],";
                    }
                    else{
                        result += '['+ getContourPoint(Top) + ',' + getContourPoint(Left) + "],";
                        result += '['+ getContourPoint(Bottom) + ',' + getContourPoint(Right) + "],";
                    }
                    break;                   
            }
        }
    }

    // This allows stuff to be added in order of finish rather than needing to be in order
    m.lock();
    totalResult += result;
    m.unlock();
}

vector<int> reconstructDijkstraRoute(int endNode, const vector<int>& prevNodes, bool reversedPath=true){
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

class MapGraphInstance{
private:
    vector<vector<Edge>> distanceAdjacencyList;
    vector<vector<Edge>> timeAdjacencyList;
    vector<vector<int>> closestNodes;
    vector<Node> mercatorNodeList;
    vector<double> nodeLats;
    vector<double> nodeLons;
    vector<double> nodeElevations;
    int nodeCount;
    double minX;
    double maxX;
    double minY;
    double maxY;
    double gridDistance;
    string regionNodes;
    string nodeLatLons;
    string nodeElevationString;

    void computeRegionNodes(){
        regionNodes = "[";
        // Get the convex hull of all points to get outer region
        for (const Node& outerNode : convexHull(mercatorNodeList)){
            regionNodes += '[' + to_string(outerNode.index) + ']' + ',';
        }
        regionNodes.pop_back();
        regionNodes += ']';
    }

    double walkingTime(int startNode, int endNode){
        // Presumes duplicate nodes have been removed
        double distance = haversineDistance(nodeLats[startNode], nodeLons[startNode], nodeLats[endNode], nodeLons[endNode]);
        double slope = (nodeElevations[endNode]-nodeElevations[startNode])/distance;
        double speed = 6*(exp(-3.5*abs(slope + 0.05))) / 3.6;
        return distance/speed;
    }

    void getClosestNodes(const string& graphFilename){
        ifstream gridIn(graphFilename);
        string line;
        getline(gridIn, line);
        vector<string> params = split(line, ',');
        minX = stod(params[0]);
        maxX = stod(params[1]);
        minY = stod(params[2]);
        maxY = stod(params[3]);
        gridDistance = stod(params[4]);

        for (double y = minY; y <= maxY; y+=gridDistance){
            getline(gridIn, line);
            params = split(line, ',');
            closestNodes.emplace_back(params.size());
            // https://stackoverflow.com/questions/20257582/convert-vectorstdstring-to-vectordouble
            transform(params.begin(), params.end(), closestNodes.back().begin(), [](const string& val)
            {
                return stoi(val);
            });
        }
    }
    LRUcache<int, pair<vector<double>, vector<int>>> dijkstraResultCache =
    LRUcache<int, pair<vector<double>, vector<int>>>([this](int x){return dijkstraResult(x, distanceAdjacencyList);});
public:
    explicit MapGraphInstance(const string& nodeFilename="map_data/nodes.csv",
                              const string& adjacencyListFilename="map_data/edges.csv",
                              const string& elevationListFilename="map_data/elevation.csv",
                              const string& graphFilename="map_data/grid2d.csv"){
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
            mercatorNodeList.emplace_back(i, mercatorXY.first, mercatorXY.second);
        }
        nodeLatLons.pop_back();
        nodeLatLons += ']';
        for (int i = 0; i < nodeCount; i++){
            distanceAdjacencyList.emplace_back();
            timeAdjacencyList.emplace_back();
        }
        for (int i = 0; i < nodeCount; i++){
            getline(edgeIn, line);
            vector<string> lineEntries = split(line, ',');
            for (unsigned int j = 0; 3 * j + 2 < lineEntries.size(); j++){
                distanceAdjacencyList[i].emplace_back(stoi(lineEntries[3*j]), stod(lineEntries[3*j+1]));
                timeAdjacencyList[i].emplace_back(stoi(lineEntries[3*j]), stod(lineEntries[3*j+2]));
            }
        }
        nodeElevationString = "[";
        getline(elevationIn, line);
        nodeElevationString += line;
        nodeElevationString += ']';
        vector<string> lineEntries = split(line, ',');
        for (const string& s : lineEntries){
            nodeElevations.push_back(stod(s));
        }
        computeRegionNodes();
        getClosestNodes(graphFilename);
    }

    string generateCycle(int startNode, double targetLength, double maxDeviance=1000){
        if (startNode < 0 || startNode >= nodeCount) return "[0,0]";
        // Dijkstra should hopefully have been recently executed for start node
        // Note dijkstra is not that computationally expensive - the main problem is delivering the results
        pair<vector<double>, vector<int>> computedDijkstra = dijkstraResultCache.getData(startNode);
        vector<double> distances = computedDijkstra.first;
        vector<int> possibleNodes;
        for (int node = 0; node < nodeCount; node++){
            if (distances[node] > targetLength/6 && distances[node] < (targetLength)/3){
                possibleNodes.push_back(node);
            }
        }
        if (possibleNodes.empty()){
            return "[0,0]";
        }
        uniform_int_distribution<> distrib(0, possibleNodes.size() - 1);
        int chosenNode = possibleNodes[distrib(gen)];

        pair<vector<double>, vector<int>> secondaryDijkstra = dijkstraResultCache.getData(chosenNode);
        vector<double> secondaryDistances = secondaryDijkstra.first;

        vector<pair<int, double>> nodeSuitability;
        nodeSuitability.reserve(nodeCount);
        for (int i = 0; i < nodeCount; i++){
            if (i==chosenNode||i==startNode){
                continue;
            }
            double deviance = abs(targetLength-distances[chosenNode]-secondaryDistances[i]-distances[i]);
            if (deviance < maxDeviance) {
                nodeSuitability.emplace_back(i, deviance);
            }
        }

        if (nodeSuitability.empty()){
            return "[0,0]";
        }

        auto compare = [](pair<int, double> a, pair<int, double> b){return a.second < b.second;};
        sort(nodeSuitability.begin(), nodeSuitability.end(), compare);

        // Generate indexes from 0 to n with linear distribution, giving index 0 weight n and index n-1 weight 1
        vector<int> weights(nodeSuitability.size());
        iota(weights.rbegin(), weights.rend(), 1);

        discrete_distribution<> discrete_distrib(weights.begin(), weights.end());
        return "[" + to_string(chosenNode) + ',' + to_string(nodeSuitability[discrete_distrib(gen)].first) + "]";
    }

    string aStar(int startNode, int endNode, bool useTime){
        if (startNode < 0 || startNode >= nodeCount) return "[0,0,[],[]]";
        if (endNode < 0 || endNode >= nodeCount) return "[0,0,[],[]]";

        aStarResultObject completedAstar;
        string result = "[";
        if (useTime) {
            completedAstar = aStarResult(startNode,
                                         endNode,
                                         timeAdjacencyList,
                                         distanceAdjacencyList,
                                         [this](int node, int endNode){
                                             return walkingTime(node, endNode);
                                         }
                                        );
            // Output of distance, time is flipped in a* if time is seen as metric to be optimised
            result += to_string(completedAstar.subsidiaryDistance) + "," + to_string(completedAstar.distance) + ",[";
        }
        else{
            completedAstar = aStarResult(startNode,
                                         endNode,
                                         distanceAdjacencyList,
                                         timeAdjacencyList,
                                         [this](int node, int endNode){
                                             return haversineDistance(nodeLats[node], nodeLons[node], nodeLats[endNode], nodeLons[endNode]);
                                         }
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

    string getNodeLatLons(){
        return nodeLatLons;
    }
    string getRegionNodes(){
        return regionNodes;
    }
    string getNodeElevations(){
        return nodeElevationString;
    }

    string isoline(int startNode, double isovalue, int threads=100){
        if (startNode < 0 || startNode >= nodeCount) return "[]";

        vector<double> distances = dijkstraResultCache.getData(startNode).first;
        // Finds appropriate row offset so each thread gets similar amount of rows to process
        int diff = (round((maxY - minY)/gridDistance))/threads + (static_cast<long long>(round((maxY - minY)/gridDistance)) % threads == 0 ? 0 : 1 );

        vector<future<void>> calculatedFutures;

        // Mutex allows result editing from different threads!
        mutex m;
        string result = "[";
        for (int i = 0; i < threads; i++){
            // cref allows async to use reference properly
            calculatedFutures.push_back(async(launch:: async,
                                              findSubisoline,
                                              gridDistance,
                                              minX,
                                              minY,
                                              minX,
                                              maxX,
                                              minY+i*diff*gridDistance,
                                              min(maxY, minY+(i+1)*(diff)*gridDistance-gridDistance),
                                              isovalue,
                                              cref(distances),
                                              cref(closestNodes),
                                              ref(result),
                                              ref(m)));
        }

        for (int i = 0; i < threads; i++){
            // Wait for all threads to finish
            calculatedFutures[i].get();
        }

        if (result.size() > 1) {
            result.pop_back();
        }
        result += ']';
        return result;
    }
};

template<class T>
struct BinaryTreeNode{
    T value;
    shared_ptr<BinaryTreeNode<T>> left;
    shared_ptr<BinaryTreeNode<T>> right;
    explicit BinaryTreeNode(T value):
            value(value)
    {}
};


class TwoDtree{
    // A k-d tree but solely for 2 dimensions
private:
    BinaryTreeNode<Node> root = BinaryTreeNode<Node>(Node(-1, -1, -1));

    static BinaryTreeNode<Node> createSubTree(vector<Node>& nodes, unsigned int left, unsigned int right, bool isX=true){
        unsigned int medianIndex = (left+right)/2;
        if (isX){
            nth_element(nodes.begin() + left,
                        nodes.begin() + medianIndex,
                        nodes.begin() + right + 1,
                        [](const Node& a, const Node& b){return a.x < b.x;});
        }
        else{
            nth_element(nodes.begin() + left,
                        nodes.begin() + medianIndex,
                        nodes.begin() + right + 1,
                        [](const Node& a, const Node& b){return a.y < b.y;});
        }

        BinaryTreeNode<Node> subRoot(nodes[medianIndex]);

        if (medianIndex>left){
            subRoot.left = make_shared<BinaryTreeNode<Node>>(createSubTree(nodes, left, medianIndex-1, !isX));
        }
        if (medianIndex < right){
            subRoot.right = make_shared<BinaryTreeNode<Node>>(createSubTree(nodes, medianIndex+1, right, !isX));
        }

        return subRoot;
    }

    pair<int, double> nearestNeighbourRecursive(const Node& node, const BinaryTreeNode<Node>& currentBTNode, bool isX=true) const{
        // Returns an integer and double pair - integer denotes index of closest node, double indicate distance of query node to this closest node
        // The distance, while not required for the final output, is needed to compare to other nodes in k-d tree
        pair<int, double> best = make_pair(currentBTNode.value.index,
                                           (node.x-currentBTNode.value.x)*(node.x-currentBTNode.value.x)+
                                           (node.y-currentBTNode.value.y)*(node.y-currentBTNode.value.y));
        pair<int, double> newPossibility;
        if ((isX?node.x:node.y) < (isX?currentBTNode.value.x:currentBTNode.value.y)){
            // smaller value - go to the left!
            if (currentBTNode.left){
                // left node exists
                newPossibility = nearestNeighbourRecursive(node, *currentBTNode.left, !isX);
                if (newPossibility.second < best.second){
                    best = newPossibility;
                }
            }
            // Can we do better if we go right instead?
            double smallestPossibleDistance;
            if (isX){
                smallestPossibleDistance = (currentBTNode.value.x-node.x)*(currentBTNode.value.x-node.x);
            }
            else{
                smallestPossibleDistance = (currentBTNode.value.y-node.y)*(currentBTNode.value.y-node.y);
            }
            if (smallestPossibleDistance<best.second&&currentBTNode.right){
                newPossibility = nearestNeighbourRecursive(node, *currentBTNode.right, !isX);
                if (newPossibility.second < best.second){
                    best = newPossibility;
                }
            }
        }
        else {
            //to the right!
            if (currentBTNode.right) {
                // left node exists
                newPossibility = nearestNeighbourRecursive(node, *currentBTNode.right, !isX);
                if (newPossibility.second < best.second) {
                    best = newPossibility;
                }
            }
            // Can we do better if we go right instead?
            double smallestPossibleDistance;
            if (isX) {
                smallestPossibleDistance = (currentBTNode.value.x - node.x) * (currentBTNode.value.x - node.x);
            } else {
                smallestPossibleDistance = (currentBTNode.value.y - node.y) * (currentBTNode.value.y - node.y);
            }
            if (smallestPossibleDistance < best.second && currentBTNode.left) {
                newPossibility = nearestNeighbourRecursive(node, *currentBTNode.left, !isX);
                if (newPossibility.second < best.second) {
                    best = newPossibility;
                }
            }
        }
        return best;
    }
public:
    explicit TwoDtree(vector<Node>& nodes){
        root = createSubTree(nodes, 0, nodes.size()-1);
    }

    int nearestNeighbour(const Node& node) const{
        return nearestNeighbourRecursive(node, root).first;
    }

};

string nearestNeighboursSubresult(double minX,
                                  double maxX,
                                  double minY,
                                  double maxY,
                                  double gridDistance,
                                  const TwoDtree& tree) {

    if (minY > maxY){
        return "";
    }

    string result;
    for (double y = minY; y <= maxY; y+= gridDistance){
        for (double x = minX; x <= maxX; x+=gridDistance){
            result += to_string(tree.nearestNeighbour(Node(-1, x, y))) + ',';
        }
        result.pop_back();
        result += '\n';
    }
    return result;
}

void compute2DNearestNeighbours(vector<tuple<long long, double, double>> nodes,
                                const string& gridFilename = "map_data/grid2d.csv",
                                double gridDistance=10,
                                int threads=300){
    vector<Node> mercatorNodes;
    double minX = numeric_limits<double>::max();
    double maxX = numeric_limits<double>::lowest();
    double minY = numeric_limits<double>::max();
    double maxY = numeric_limits<double>::lowest();
    for (unsigned int i = 0; i < nodes.size(); i++){
        pair<double, double> mercatorXY = mercator(get<1>(nodes[i]), get<2>(nodes[i]));
        minX = min(minX, mercatorXY.first);
        minY = min(minY, mercatorXY.second);
        maxX = max(maxX, mercatorXY.first);
        maxY = max(maxY, mercatorXY.second);
        mercatorNodes.emplace_back(i, mercatorXY.first, mercatorXY.second);
    }

    // Make sure grid covers area ever so slightly more than points on grid.
    minX = floor(minX/gridDistance)*gridDistance;
    minY = floor(minY/gridDistance)*gridDistance;
    maxX = ceil(maxX/gridDistance)*gridDistance;
    maxY = ceil(maxY/gridDistance)*gridDistance;

    TwoDtree tree = TwoDtree(mercatorNodes);
    ofstream fout(gridFilename);
    fout <<  to_string(minX) << ',' << to_string(maxX) << ',' << to_string(minY) << ',' << to_string(maxY) << ',' << gridDistance << '\n';

    vector<future<string>> calculatedFutures;
    int diff = (round((maxY - minY)/gridDistance))/threads + (static_cast<long long>(round((maxY - minY)/gridDistance)) % threads == 0 ? 0 : 1 );
    for (int i = 0; i < threads; i++){
        // cref allows async to use reference properly
        calculatedFutures.push_back(async(launch:: async,
                                          &nearestNeighboursSubresult,
                                          minX,
                                          maxX,
                                          minY+i*diff*gridDistance,
                                          min(maxY, minY+(i+1)*(diff)*gridDistance-gridDistance),
                                          gridDistance,
                                          cref(tree)));
    }

    for (int i = 0; i < threads; i++){
        fout << calculatedFutures[i].get();
    }
}

PYBIND11_MODULE(graph_algorithms, m) {
     py::class_<MapGraphInstance>(m, "MapGraphInstance")
         .def(py::init<string, string, string, string>(),
            py::arg("node_filename") = "map_data/nodes.csv",
            py::arg("adjacency_list_filename") = "map_data/edges.csv",
            py::arg("elevation_list_filename") = "map_data/elevation.csv",
            py::arg("grid_filename") = "map_data/grid2d.csv"
        )
        .def("get_region_nodes", &MapGraphInstance::getRegionNodes)
        .def("get_node_lat_lons", &MapGraphInstance::getNodeLatLons)
        .def("get_node_elevations", &MapGraphInstance::getNodeElevations)
        .def("generate_cycle", &MapGraphInstance::generateCycle,
            py::arg("start_node"),
            py::arg("target_length"),
            py::arg("max_deviance")=1000)
        .def("a_star", &MapGraphInstance::aStar,
            py::arg("start_node"),
            py::arg("end_node"),
            py::arg("use_time"))
         .def("isoline", &MapGraphInstance::isoline,
            py::arg("start_node"),
            py::arg("isovalue"),
            py::arg("threads")=100);
     m.def("compute_2D_nearest_neighbours", &compute2DNearestNeighbours,
            py::arg("nodes"),
            py::arg("grid_filename")="map_data/grid2d.csv",
            py::arg("grid_distance")=10,
            py::arg("threads")=300);
}

import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Node,
  Edge,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

/**
 * LEVEL-ORDER (NX-LIKE) TREE LAYOUT
 * --------------------------------
 * - X axis = breadth (siblings)
 * - Y axis = level (topological height)
 * - Same height => same horizontal row
 * - Clean straight edges, no force layout
 */


export default function NxStyleDependencyTree({graphData}) {

  const NODE_WIDTH = 260;
  const NODE_HEIGHT = 56;
  const X_GAP = 60;
  const Y_GAP = 120;

  function buildLevelOrderGraph(data: any) {
    // console.log(data, "data")
    if(!data) 
      return { nodes: [], edges: [] };
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const { bottomTree, topTree, packageMetadata } = data ?? {};
    const metaFor = (pkg: string) =>
      packageMetadata?.[pkg] as { rootDir?: string; platform?: string } | undefined;
    const bt = bottomTree ?? {};
    const tt = topTree ?? {};

    /** 1️⃣ Collect nodes grouped strictly by height */
    const levels = new Map<number, string[]>();

    const collect = (tree: any) => {
      Object.entries(tree).forEach(([name, info]: any) => {
        if (!levels.has(info.height)) levels.set(info.height, []);
        levels.get(info.height)!.push(name);
      });
    };

    collect(bt);
    collect(tt);

    /** 2️⃣ Sort levels (NX style: top → bottom) */
    const sortedLevels = [...levels.entries()].sort(
      ([a], [b]) => a - b
    );

    /** 3️⃣ Create nodes level-by-level (LEVEL ORDER) */
    sortedLevels.forEach(([level, pkgs], rowIndex) => {
      pkgs.forEach((pkg, colIndex) => {
        const info = bt[pkg] ?? tt[pkg];
        const isFrozen = Boolean(info?.frozen);
        const platform = metaFor(pkg)?.platform ?? "unknown";
        const platformLabel =
          platform === "node"
            ? "Node"
            : platform === "maven"
              ? "Maven"
              : platform === "unknown"
                ? "?"
                : platform;

        nodes.push({
          id: pkg,
          position: {
            x: colIndex * (NODE_WIDTH + X_GAP),
            y: rowIndex * (NODE_HEIGHT + Y_GAP),
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          className: isFrozen ? "atlas-graph-node atlas-graph-node--frozen" : "atlas-graph-node",
          data: {
            label: (
              <div className={`atlas-node-inner${isFrozen ? " atlas-node-inner--frozen" : ""}`}>
                <div className="atlas-node-header">
                  <div className="atlas-node-name">{pkg}</div>
                  <div className="atlas-node-badges">
                    <span
                      className="atlas-platform-badge"
                      title="Release adapter (quark-scripts): Node vs Maven"
                    >
                      {platformLabel}
                    </span>
                    {isFrozen ? (
                      <span className="atlas-frozen-badge" title="Release map: frozen (pinned workspace deps)">
                        Frozen
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="atlas-node-version">v{info.version}</div>
              </div>
            ),
          },
          style: {
            width: NODE_WIDTH,
            borderRadius: 8,
            ...(isFrozen
              ? {
                  border: "2px solid #0c4a6e",
                  background: "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)",
                  boxShadow: "0 1px 0 rgba(12, 74, 110, 0.06) inset",
                }
              : {
                  border: "1px solid #d0d7de",
                  background: "#ffffff",
                }),
          },
        });
      });
    });

    /** 4️⃣ Bottom tree edges (dependencies → dependents) */
    Object.entries(bt).forEach(([name, info]: any) => {
      info.parentNodes?.forEach((p: any) => {
        edges.push({
          id: `${p.name}->${name}`,
          source: p.name,
          target: name,
          type: "straight",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 1.5 },
        });
      });
    });

    /** 5️⃣ Top tree edges (consumers) */
    Object.entries(tt).forEach(([name, info]: any) => {
      info.childNodes?.forEach((c: any) => {
        edges.push({
          id: `${name}->${c.name}`,
          source: name,
          target: c.name,
          type: "straight",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeDasharray: "6 4", strokeWidth: 1.3 },
        });
      });
    });

    return { nodes, edges };
  }

  const { nodes, edges } = useMemo(() => buildLevelOrderGraph(graphData), [graphData]);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        panOnDrag
        zoomOnScroll
      >
        <Background gap={32} />
        <Controls />
      </ReactFlow>

      <style>{`
        .atlas-node-inner {
          font-size: 12px;
          line-height: 1.35;
          text-align: left;
        }
        .atlas-node-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .atlas-node-badges {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }
        .atlas-platform-badge {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #24292f;
          background: #f6f8fa;
          border: 1px solid #d0d7de;
          border-radius: 4px;
          padding: 2px 6px;
          line-height: 1.2;
        }
        .atlas-node-name {
          font-weight: 600;
          word-break: break-all;
          flex: 1;
          min-width: 0;
        }
        .atlas-node-version {
          margin-top: 4px;
          color: #57606a;
        }
        .atlas-node-inner--frozen .atlas-node-version {
          color: #0c4a6e;
        }
        .atlas-frozen-badge {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #0c4a6e;
          background: #bae6fd;
          border: 1px solid #7dd3fc;
          border-radius: 4px;
          padding: 2px 6px;
          line-height: 1.2;
        }
        .react-flow__node.atlas-graph-node:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        .react-flow__node.atlas-graph-node:not(.atlas-graph-node--frozen):hover {
          border-color: #0969da !important;
        }
        .react-flow__node.atlas-graph-node--frozen:hover {
          border-color: #0369a1 !important;
          box-shadow: 0 4px 18px rgba(3, 105, 161, 0.18);
        }
      `}</style>
    </div>
  );
}

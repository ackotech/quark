"use client"
import React, { useState, useEffect, useMemo } from "react";
import { Collapse, Select, Typography } from "antd";
import Graph from "@components/graph";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const { Title, Text } = Typography;

export default function Page() {
    const [componenData, setComponenData] = useState<Record<string, { tag: string; version: string }[]>>({});
    const [componentList, setComponentList] = useState<{ value: string; label: string }[]>([]);
    const [selectedPackageName, setSelectedPackageName] = useState<string>("");
    const [selectedTag, setSelectedTag] = useState<string>("");
    const [tagList, setTagList] = useState<{ value: string; label: string }[]>([]);
    const [graphData, setGraphData] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        fetch("/api/fetchComponentList")
            .then(res => res.json())
            .then(data => {
                setComponenData(data.data)
                const tempData = Object.keys(data.data).map((item: string) => ({
                    value: item,
                    label: item,
                }))
                setComponentList(tempData)
            })
    }, []);

    const loadGraph = (pkg: string, tag: string) => {
        const q = new URLSearchParams({
            packageName: pkg,
            tag,
        });
        fetch(`/api/fetchGraph?${q.toString()}`)
            .then(res => res.json())
            .then(data => {
                setGraphData(data.data)
            })
    };

    const onVersionChange = (value: string) => {
        setSelectedTag(value);
        if (!selectedPackageName) return;
        loadGraph(selectedPackageName, value);
    };

    const onChangeName = (value: string) => {
        const rows = componenData[value] ?? [];
        const tempData = rows.map((item) => ({
            value: item.tag,
            label: item.version,
        }));
        setSelectedPackageName(value);
        setTagList(tempData);
        if (rows.length > 0) {
            const firstTag = rows[0].tag;
            setSelectedTag(firstTag);
            loadGraph(value, firstTag);
        } else {
            setSelectedTag("");
            setGraphData(null);
        }
    };

    const releaseCollapseItems = useMemo(() => {
        if (!graphData) return [];
        const order = (graphData.releaseExecutionOrder as string[] | undefined) ?? [];
        const note = (graphData.releaseNote as { body?: string; err?: string } | undefined)?.body;
        const ghErr = (graphData.releaseNote as { err?: string } | undefined)?.err;

        return [
            {
                key: "order",
                label: "Release execution order (same topo direction as quark-scripts release)",
                children: (
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                        {order.length > 0 ? (
                            <code style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                {order.join(" → ")}
                            </code>
                        ) : (
                            <span style={{ color: "#57606a" }}>Select a package and tag to see the subgraph order.</span>
                        )}
                    </div>
                ),
            },
            {
                key: "notes",
                label: "Release notes (GitHub release body for the selected tag, when available)",
                children: ghErr ? (
                    <span style={{ color: "#9a6700" }}>{ghErr}</span>
                ) : note ? (
                    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note}</ReactMarkdown>
                    </div>
                ) : (
                    <span style={{ color: "#57606a" }}>No release body for this tag, or GitHub CLI not used.</span>
                ),
            },
        ];
    }, [graphData]);

    return (
        <>
            <div style={{ width: "100%", display: "flex", flexDirection: "row", gap: "16px", }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                    <div style={{ width: "100%", padding: "16px", boxSizing: "border-box", display: "flex", flexDirection: "row", gap: "16px", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)", borderRadius: "12px" }}>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                paddingLeft: 14,
                                borderLeft: "4px solid #1677ff",
                                minWidth: 0,
                            }}
                        >
                            <Title
                                level={3}
                                style={{
                                    margin: 0,
                                    fontWeight: 700,
                                    letterSpacing: "-0.03em",
                                    lineHeight: 1.15,
                                    fontSize: 22,
                                }}
                            >
                                Atlas
                            </Title>
                            <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
                                Dependency graph & release map for your workspace
                            </Text>
                        </div>

                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    width: "100%",
                                    gap: "16px",
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    alignItems: "center",
                                }}
                            >
                                <Select
                                    showSearch={{ optionFilterProp: "label" }}
                                    placeholder="Select Package Name"
                                    onChange={onChangeName}
                                    style={{ width: "400px" }}
                                    options={componentList}
                                />
                                <Select
                                    showSearch={{ optionFilterProp: "label" }}
                                    placeholder="Select a version"
                                    value={selectedTag || undefined}
                                    onChange={onVersionChange}
                                    options={tagList}
                                />
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {selectedPackageName && selectedTag ? (
                            <div
                                style={{
                                    padding: "12px 16px",
                                    borderRadius: "12px",
                                    background: "#fff",
                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                                }}
                            >
                                <div style={{ marginBottom: 8, fontSize: 13, color: "#57606a" }}>
                                    Package <strong>{selectedPackageName}</strong>
                                    {" · "}
                                    map / tag <strong>{selectedTag}</strong>
                                    {" — "}
                                    versions and <em>Frozen</em> badges follow <code>.release/map.json</code> (quark-scripts release / unfreeze).
                                </div>
                                <Collapse items={releaseCollapseItems} defaultActiveKey={["order"]} />
                            </div>
                        ) : null}
                        <div style={{ minHeight: "70vh" }}>
                            <Graph graphData={graphData} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

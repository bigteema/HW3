/* helper function: creating margin frame and inner group */
function createFrame(svg, margin) {
  const width = +svg.getAttribute("width");
  const height = +svg.getAttribute("height");
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = d3.select(svg).append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  return { g, innerW, innerH, width, height };
}

/* Part 2.1: boxplot (AgeGroup vs Likes) */
d3.csv("socialMedia.csv", d => ({ ...d, Likes: +d.Likes }))
  .then(data => {
    data = data.filter(d => d.AgeGroup && Number.isFinite(d.Likes));

    const svg = document.getElementById("boxplot");
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const { g, innerW, innerH } = createFrame(svg, margin);

    const groups = Array.from(new Set(data.map(d => d.AgeGroup)));
    const x = d3.scaleBand().domain(groups).range([0, innerW]).padding(0.3);
    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.Likes)).nice()
      .range([innerH, 0]);

    g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
    g.append("g").call(d3.axisLeft(y));
    g.append("text").attr("x", innerW / 2).attr("y", innerH + 50).attr("text-anchor", "middle").text("Age Group");
    g.append("text").attr("transform", "rotate(-90)").attr("x", -innerH / 2).attr("y", -42).attr("text-anchor", "middle").text("Likes");

    function rollup(v) {
      const a = v.map(d => d.Likes).sort(d3.ascending);
      const q1 = d3.quantile(a, 0.25);
      const med = d3.quantile(a, 0.5);
      const q3 = d3.quantile(a, 0.75);
      return { q1, med, q3, min: d3.min(a), max: d3.max(a) };
    }

    const stats = d3.rollup(data, rollup, d => d.AgeGroup);

    stats.forEach((q, grp) => {
      const bx = x(grp), bw = x.bandwidth();
      g.append("line").attr("x1", bx + bw / 2).attr("x2", bx + bw / 2)
        .attr("y1", y(q.min)).attr("y2", y(q.max)).attr("stroke", "#374151");
      g.append("rect").attr("x", bx + bw * 0.15).attr("width", bw * 0.7)
        .attr("y", y(q.q3)).attr("height", Math.max(1, y(q.q1) - y(q.q3)))
        .attr("fill", "#e5e7eb").attr("stroke", "#374151");
      g.append("line").attr("x1", bx + bw * 0.15).attr("x2", bx + bw * 0.85)
        .attr("y1", y(q.med)).attr("y2", y(q.med)).attr("stroke", "#111827").attr("stroke-width", 2);
    });
  });

/* Part 2.2: side-by-side bar plot */
/* reading either long format (Platform,PostType,AvgLikes) or wide pivot (Image,Link,Video) and reshaping if needed */
d3.csv("socialMediaAvg.csv").then(raw => {
  let data;

  const hasLongCols = "Platform" in raw[0] && "PostType" in raw[0] && ("AvgLikes" in raw[0] || "avgLikes" in raw[0]);
  if (hasLongCols) {
    data = raw.map(d => ({
      Platform: String(d.Platform).trim(),
      PostType: String(d.PostType).trim(),
      AvgLikes: +d.AvgLikes || +d.avgLikes
    })).filter(d => d.Platform && d.PostType && Number.isFinite(d.AvgLikes));
  } else {
    /* reshaping wide pivot into long rows */
    const allKeys = Object.keys(raw[0]);
    const platformKey = allKeys.find(k => k.toLowerCase() === "platform") || allKeys[0];
    const typeKeys = allKeys.filter(k => k !== platformKey);
    data = [];
    raw.forEach(row => {
      const platform = String(row[platformKey]).trim();
      typeKeys.forEach(k => {
        const val = +row[k];
        if (platform && Number.isFinite(val)) {
          data.push({ Platform: platform, PostType: String(k).trim(), AvgLikes: val });
        }
      });
    });
  }

  const svg = document.getElementById("bars");
  const margin = { top: 20, right: 20, bottom: 70, left: 60 };
  const { g, innerW, innerH } = createFrame(svg, margin);

  const platforms = Array.from(new Set(data.map(d => d.Platform)));
  const postTypes = Array.from(new Set(data.map(d => d.PostType)));

  const x0 = d3.scaleBand().domain(platforms).range([0, innerW]).paddingInner(0.2);
  const x1 = d3.scaleBand().domain(postTypes).range([0, x0.bandwidth()]).padding(0.15);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.AvgLikes)]).nice().range([innerH, 0]);
  const color = d3.scaleOrdinal().domain(postTypes).range(d3.schemeTableau10);

  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x0));
  g.append("g").call(d3.axisLeft(y));
  g.append("text").attr("x", innerW / 2).attr("y", innerH + 55).attr("text-anchor", "middle").text("Platform");
  g.append("text").attr("transform", "rotate(-90)").attr("x", -innerH / 2).attr("y", -42).attr("text-anchor", "middle").text("Average Likes");

  const grouped = d3.group(data, d => d.Platform);
  const groups = g.selectAll(".g-platform").data(platforms).join("g")
    .attr("class", "g-platform")
    .attr("transform", d => `translate(${x0(d)},0)`);

  groups.each(function (platform) {
    const rows = grouped.get(platform) || [];
    d3.select(this).selectAll("rect")
      .data(rows)
      .join("rect")
      .attr("x", d => x1(d.PostType))
      .attr("y", d => y(d.AvgLikes))
      .attr("width", x1.bandwidth())
      .attr("height", d => innerH - y(d.AvgLikes))
      .attr("fill", d => color(d.PostType));
  });

  const legend = g.append("g").attr("transform", `translate(${innerW - 140}, 0)`);
  postTypes.forEach((pt, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
    row.append("rect").attr("width", 12).attr("height", 12).attr("fill", color(pt));
    row.append("text").attr("x", 16).attr("y", 10).text(pt);
  });
});

/* Part 2.3: line plot */
/* reading time averages and handling flexible headers */
d3.csv("socialMediaTime.csv").then(raw => {
  const dateKey = Object.keys(raw[0]).find(k => k.toLowerCase().startsWith("date"));
  const avgKey = Object.keys(raw[0]).find(k => k.toLowerCase().includes("avglike") || k.toLowerCase().includes("average"));

  let data = raw.map(d => ({
    Date: String(d[dateKey]).trim(),
    AvgLikes: +d[avgKey]
  })).filter(d => d.Date && Number.isFinite(d.AvgLikes));

  const svg = document.getElementById("line");
  const margin = { top: 20, right: 20, bottom: 90, left: 60 };
  const { g, innerW, innerH } = createFrame(svg, margin);

  const x = d3.scalePoint().domain(data.map(d => d.Date)).range([0, innerW]).padding(0.5);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.AvgLikes)]).nice().range([innerH, 0]);

  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x))
    .selectAll("text").style("text-anchor", "end").attr("transform", "rotate(-25)");
  g.append("g").call(d3.axisLeft(y));
  g.append("text").attr("x", innerW / 2).attr("y", innerH + 70).attr("text-anchor", "middle").text("Date");
  g.append("text").attr("transform", "rotate(-90)").attr("x", -innerH / 2).attr("y", -42).attr("text-anchor", "middle").text("Average Likes");

  const line = d3.line().x(d => x(d.Date)).y(d => y(d.AvgLikes)).curve(d3.curveNatural);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", "#2563eb").attr("stroke-width", 2).attr("d", line);

  g.selectAll("circle.point").data(data).join("circle")
    .attr("class", "point").attr("cx", d => x(d.Date)).attr("cy", d => y(d.AvgLikes)).attr("r", 3.5).attr("fill", "#2563eb");
});

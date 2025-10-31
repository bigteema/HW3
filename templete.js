/* helper function for creating margin frame and inner group */
function createFrame(svg, margin) {
  const width = +svg.getAttribute("width");
  const height = +svg.getAttribute("height");
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = d3.select(svg).append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  return { g, innerW, innerH, width, height };
}

/*  Part 2.1: side-by-side boxplot */
/* reading data and converting Likes to number */
d3.csv("socialMedia.csv", d => ({ ...d, Likes: +d.Likes }))
  .then(data => {
    /* keeping valid rows */
    data = data.filter(d => d.AgeGroup && Number.isFinite(d.Likes));

    const svg = document.getElementById("boxplot");
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const { g, innerW, innerH } = createFrame(svg, margin);

    /* setting up scales */
    const groups = Array.from(new Set(data.map(d => d.AgeGroup)));
    const xScale = d3.scaleBand().domain(groups).range([0, innerW]).padding(0.3);

    const yExtent = d3.extent(data, d => d.Likes);
    const yScale = d3.scaleLinear()
      .domain([Math.min(0, yExtent[0]), yExtent[1]]).nice()
      .range([innerH, 0]);

    /* drawing axes and labels */
    g.append("g").attr("class", "axis x")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale));
    g.append("g").attr("class", "axis y").call(d3.axisLeft(yScale));

    g.append("text").attr("x", innerW / 2).attr("y", innerH + 50)
      .attr("text-anchor", "middle").text("Age Group");
    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -42)
      .attr("text-anchor", "middle").text("Likes");

    /* defining a rollup that is computing quartiles per group */
    function rollupFunction(v) {
      const likes = v.map(d => d.Likes).sort(d3.ascending);
      const q1 = d3.quantile(likes, 0.25);
      const median = d3.quantile(likes, 0.5);
      const q3 = d3.quantile(likes, 0.75);
      const iqr = q3 - q1;
      const min = d3.min(likes);     /* ignoring outliers per instructions */
      const max = d3.max(likes);
      return { q1, median, q3, iqr, min, max };
    }

    /* grouping by AgeGroup and computing q1, median, q3 for each */
    const quantilesByGroups = d3.rollup(data, rollupFunction, d => d.AgeGroup);

    /* iterating over groups and drawing whiskers, boxes, and medians */
    quantilesByGroups.forEach((q, AgeGroup) => {
      const x = xScale(AgeGroup);
      const bw = xScale.bandwidth();

      /* drawing whisker from min to max */
      g.append("line")
        .attr("x1", x + bw / 2).attr("x2", x + bw / 2)
        .attr("y1", yScale(q.min)).attr("y2", yScale(q.max))
        .attr("stroke", "#374151");

      /* drawing iqr box from q1 to q3 */
      g.append("rect")
        .attr("x", x + bw * 0.15)
        .attr("width", bw * 0.7)
        .attr("y", yScale(q.q3))
        .attr("height", Math.max(1, yScale(q.q1) - yScale(q.q3)))
        .attr("fill", "#e5e7eb")
        .attr("stroke", "#374151");

      /* drawing median line */
      g.append("line")
        .attr("x1", x + bw * 0.15)
        .attr("x2", x + bw * 0.85)
        .attr("y1", yScale(q.median))
        .attr("y2", yScale(q.median))
        .attr("stroke", "#111827")
        .attr("stroke-width", 2);
    });
  });

/* Part 2.2: side-by-side bar plot */
/* reading pre-aggregated averages for Platform and PostType */
d3.csv("socialMediaAvg.csv", d => ({
  Platform: d.Platform,
  PostType: d.PostType,
  AvgLikes: +d.AvgLikes
})).then(data => {
  const svg = document.getElementById("bars");
  const margin = { top: 20, right: 20, bottom: 70, left: 60 };
  const { g, innerW, innerH } = createFrame(svg, margin);

  /* setting up band scales and color */
  const platforms = Array.from(new Set(data.map(d => d.Platform)));
  const postTypes = Array.from(new Set(data.map(d => d.PostType)));

  const x0 = d3.scaleBand().domain(platforms).range([0, innerW]).paddingInner(0.2);
  const x1 = d3.scaleBand().domain(postTypes).range([0, x0.bandwidth()]).padding(0.15);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.AvgLikes)]).nice().range([innerH, 0]);
  const color = d3.scaleOrdinal().domain(postTypes).range(d3.schemeTableau10);

  /* drawing axes and labels */
  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x0));
  g.append("g").call(d3.axisLeft(y));

  g.append("text").attr("x", innerW / 2).attr("y", innerH + 55)
    .attr("text-anchor", "middle").text("Platform");
  g.append("text").attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -42)
    .attr("text-anchor", "middle").text("Average Likes");

  /* grouping rows by platform and drawing bars for each post type inside */
  const byPlatform = d3.group(data, d => d.Platform);

  const groups = g.selectAll(".g-platform")
    .data(platforms)
    .join("g")
    .attr("class", "g-platform")
    .attr("transform", d => `translate(${x0(d)},0)`);

  groups.each(function(platform) {
    const rows = byPlatform.get(platform) || [];
    d3.select(this).selectAll("rect")
      .data(rows, d => d.PostType)
      .join("rect")
      .attr("x", d => x1(d.PostType))
      .attr("y", d => y(d.AvgLikes))
      .attr("width", x1.bandwidth())
      .attr("height", d => innerH - y(d.AvgLikes))
      .attr("fill", d => color(d.PostType));
  });

  /* drawing legend with color squares */
  const legend = g.append("g").attr("transform", `translate(${innerW - 140}, 0)`);
  postTypes.forEach((pt, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
    row.append("rect").attr("width", 12).attr("height", 12).attr("fill", color(pt));
    row.append("text").attr("x", 16).attr("y", 10).text(pt);
  });
});

/* Part 2.3: line plot */
/* reading daily averages and drawing a smooth line */
d3.csv("socialMediaTime.csv", d => ({
  Date: d.DateLabel,
  AvgLikes: +d.AvgLikes
})).then(data => {
  const svg = document.getElementById("line");
  const margin = { top: 20, right: 20, bottom: 90, left: 60 };
  const { g, innerW, innerH } = createFrame(svg, margin);

  /* using point scale for label dates */
  const x = d3.scalePoint()
    .domain(data.map(d => d.Date))
    .range([0, innerW])
    .padding(0.5);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.AvgLikes)]).nice()
    .range([innerH, 0]);

  /* drawing axes with rotated labels */
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("transform", "rotate(-25)");
  g.append("g").call(d3.axisLeft(y));

  g.append("text").attr("x", innerW / 2).attr("y", innerH + 70)
    .attr("text-anchor", "middle").text("Date");
  g.append("text").attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -42)
    .attr("text-anchor", "middle").text("Average Likes");

  /* creating the path with curveNatural */
  const line = d3.line()
    .x(d => x(d.Date))
    .y(d => y(d.AvgLikes))
    .curve(d3.curveNatural);

  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#2563eb")
    .attr("stroke-width", 2)
    .attr("d", line);

  /* adding points for readability */
  g.selectAll("circle.point")
    .data(data)
    .join("circle")
    .attr("class", "point")
    .attr("cx", d => x(d.Date))
    .attr("cy", d => y(d.AvgLikes))
    .attr("r", 3.5)
    .attr("fill", "#2563eb");
});

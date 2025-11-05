import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ------------------------------------------------------------
// INTERACTIVE SKINCARE BUBBLE CHART
// (MULTI SKIN TYPE FILTER + RELATIVE COLORS + PRICE CLUSTERING)
// ------------------------------------------------------------
d3.csv("data/cosmetic_p.csv").then(data => {
  // ------------------------------------------------------------
  // DATA PREPARATION
  // ------------------------------------------------------------
  data.forEach(d => {
    d.price = +d.price || 0;
    d.rank = +d.rank || 0;
    d.Combination = +d.Combination || 0;
    d.Dry = +d.Dry || 0;
    d.Normal = +d.Normal || 0;
    d.Oily = +d.Oily || 0;
    d.Sensitive = +d.Sensitive || 0;
  });

  const width = 950, height = 650;

  const svg = d3.select("#brand-bubble-chart")
    .attr("width", width)
    .attr("height", height);

  // ------------------------------------------------------------
  // TOOLTIP
  // ------------------------------------------------------------
  if (d3.select("#tooltip").empty()) {
    d3.select("body").append("div")
      .attr("id", "tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("padding", "6px 10px")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("opacity", 0);
  }

  //------------------------------------------------------------
// CONTROLS (CATEGORY, SKIN TYPE, PRICE)
//------------------------------------------------------------
const categories = Array.from(new Set(data.map(d => d.Label))).sort();
const skinTypes = ["Combination", "Dry", "Normal", "Oily", "Sensitive"];
const maxPrice = d3.max(data, d => d.price);

const controls = d3.select("#controls").html(`
  <label>Category: </label>
  <select id="categorySelect">
    <option value="All">All</option>
    ${categories.map(c => `<option value="${c}">${c}</option>`).join("")}
  </select>
  &nbsp;&nbsp;
  <label>Skin Type: </label>
  <select id="skinSelect">
    <option value="All">All</option>
    ${skinTypes.map(s => `<option value="${s}">${s}</option>`).join("")}
  </select>
  &nbsp;&nbsp;
  <label>Max Price: </label>
  <input type="range" id="priceSlider" min="0" max="${maxPrice}" value="${maxPrice}" step="1" style="width:200px;">
  <span id="priceLabel">${maxPrice}</span>
  &nbsp;&nbsp;
  <button id="resetBtn">Reset Filters</button>
`);

  // ------------------------------------------------------------
  // SIZE SCALE (STATIC)
  // ------------------------------------------------------------
  const size = d3.scaleSqrt()
    .domain(d3.extent(data, d => d.price))
    .range([10, 60]);

  // ------------------------------------------------------------
  // LEGEND + ARROW MARKER SETUP
  // ------------------------------------------------------------
  const defs = svg.append("defs");

  // Color gradient
  const gradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

  // Arrow marker
  defs.append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#555");

  // Legend group
  const legendWidth = 200, legendHeight = 10;
  const legendGroup = svg.append("g")
    .attr("class", "legend-group")
    .attr("transform", `translate(${width - legendWidth - 40}, ${height - 60})`);

  legendGroup.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");

  legendGroup.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -10)
    .attr("font-size", "12px")
    .attr("text-anchor", "middle")
    .text("Rating (relative)");

  // ------------------------------------------------------------
  // UPDATE FUNCTION
  // ------------------------------------------------------------
  function updateChart() {
    const selectedCategory = d3.select("#categorySelect").property("value");
    const selectedSkins = Array.from(d3.select("#skinSelect").node().selectedOptions).map(o => o.value);
    const maxP = +d3.select("#priceSlider").property("value");
    d3.select("#priceLabel").text(maxP);

    // Filter data
    const selectedSkin = d3.select("#skinSelect").property("value");

let filtered = data.filter(d =>
  (selectedCategory === "All" || d.Label === selectedCategory) &&
  d.price <= maxP &&
  (selectedSkin === "All" || d[selectedSkin] === 1)
);


    // Top 15 by rating
    filtered = filtered.sort((a, b) => d3.descending(a.rank, b.rank)).slice(0, 15);

    // Color scale (dynamic)
    const minRank = d3.min(filtered, d => d.rank);
    const maxRank = d3.max(filtered, d => d.rank);
    const color = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([minRank || 0, maxRank || 1]);

    // Update gradient stops
    const stops = gradient.selectAll("stop")
      .data(d3.ticks(0, 1, 10));
    stops.enter()
      .append("stop")
      .merge(stops)
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d => d3.interpolateRdYlGn(d));
    stops.exit().remove();

    // Update legend numeric labels
    svg.selectAll(".legend-min, .legend-max").remove();
    legendGroup.append("text")
      .attr("class", "legend-min")
      .attr("x", 0)
      .attr("y", -2)
      .attr("font-size", "10px")
      .text(minRank ? minRank.toFixed(1) : "–");
    legendGroup.append("text")
      .attr("class", "legend-max")
      .attr("x", legendWidth)
      .attr("y", -2)
      .attr("font-size", "10px")
      .attr("text-anchor", "end")
      .text(maxRank ? maxRank.toFixed(1) : "–");

    // Force simulation// --- Dynamic horizontal padding to prevent clipping on both sides ---
const maxRadius = d3.max(filtered, d => size(d.price)) || 60;

// Compute domain slightly extended beyond min/max
const priceExtent = d3.extent(filtered, d => d.price);
const priceRange = priceExtent[1] - priceExtent[0];
const domainMin = priceExtent[0] - priceRange * 0.05;
const domainMax = priceExtent[1] + priceRange * 0.15; // extra right-side buffer for legend area

// --- Compute full width range, respecting bubble radius ---
const leftPad = maxRadius + 20;
const rightPad = maxRadius + 40; // add a little extra on right for labels + arrow
const xScale = d3.scaleLinear()
  .domain([domainMin, domainMax])
  .range([leftPad, width - rightPad]);

// --- Force simulation (balanced + constrained layout) ---
const simulation = d3.forceSimulation(filtered)
  .alphaDecay(0.05)
  .force("charge", d3.forceManyBody().strength(1.8)) // gentle push so bubbles don't drift out
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide().radius(d => size(d.price) + 4))
  .force("x", d3.forceX(d => xScale(d.price)).strength(0.4))
  .force("y", d3.forceY(height / 2).strength(0.12))
  .on("tick", ticked);


    // Draw bubbles
    const node = svg.selectAll("circle")
      .data(filtered, d => d.name);

    node.enter()
      .append("circle")
      .attr("r", d => size(d.price))
      .attr("fill", d => color(d.rank))
      .attr("stroke", "#333")
      .attr("stroke-width", 1)
      .attr("opacity", 0.9)
      .attr("cursor", "pointer")
      .on("mouseover", (event, d) => {
        d3.select("#tooltip")
          .style("opacity", 1)
          .html(`
            <strong>${d.name}</strong><br>
            Brand: ${d.brand}<br>
            Category: ${d.Label}<br>
            💲${d.price}<br>
            ⭐ Rating: ${d.rank.toFixed(2)}<br>
            Skin Types: ${skinTypes.filter(s => d[s] === 1).join(", ")}
          `)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => d3.select("#tooltip").style("opacity", 0))
      .merge(node)
      .transition()
      .duration(800)
      .attr("r", d => size(d.price))
      .attr("fill", d => color(d.rank));

    node.exit().remove();

    // Labels
    const label = svg.selectAll("text.bubble-label")
      .data(filtered, d => d.name);

    label.enter()
      .append("text")
      .attr("class", "bubble-label")
      .text(d => d.brand.length > 10 ? d.brand.slice(0, 10) + "…" : d.brand)
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .merge(label)
      .transition()
      .duration(800)
      .attr("font-size", "10px");

    label.exit().remove();

    function ticked() {
  const maxRadius = d3.max(filtered, d => size(d.price)) || 60;

  svg.selectAll("circle")
    .attr("cx", d => Math.max(maxRadius, Math.min(width - maxRadius, d.x)))
    .attr("cy", d => d.y);

  svg.selectAll(".bubble-label")
    .attr("x", d => Math.max(maxRadius, Math.min(width - maxRadius, d.x)))
    .attr("y", d => d.y + 3);
}


    // Price direction arrow axis
    svg.selectAll(".price-axis, .price-arrow-label").remove();
    const arrowY = height - 100;

    svg.append("line")
      .attr("class", "price-axis")
      .attr("x1", 120)
      .attr("y1", arrowY)
      .attr("x2", width - 120)
      .attr("y2", arrowY)
      .attr("stroke", "#555")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    svg.append("text")
      .attr("class", "price-arrow-label")
      .attr("x", width / 2)
      .attr("y", arrowY - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .text("Price → (increases left → right)");
  }

  // ------------------------------------------------------------
  // RESET FILTERS
  // ------------------------------------------------------------
 d3.select("#resetBtn").on("click", () => {
  d3.select("#categorySelect").property("value", "All");
  d3.select("#skinSelect").property("value", "All");
  d3.select("#priceSlider").property("value", maxPrice);
  d3.select("#priceLabel").text(maxPrice);
  updateChart();
});


  // ------------------------------------------------------------
  // EVENT LISTENERS
  // ------------------------------------------------------------
  d3.selectAll("#categorySelect, #skinSelect, #priceSlider")
    .on("change input", updateChart);

  // INITIAL RENDER
  updateChart();
});

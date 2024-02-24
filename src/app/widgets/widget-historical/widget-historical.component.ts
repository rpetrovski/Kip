import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register();

import { DataSetService } from '../../core/services/data-set.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

interface IDataSetOptions {
    label: string;
    data: any;
    fill: string;
    borderColor: any;
    borderDash?: number[];
}

@Component({
  selector: 'app-widget-historical',
  templateUrl: './widget-historical.component.html',
  styleUrls: ['./widget-historical.component.css']
})
export class WidgetHistoricalComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('lineGraph', {static: true, read: ElementRef}) lineGraph: ElementRef;

  chartCtx;
  chart = null;

  chartDataMin = [];
  chartDataAvg = [];
  chartDataMax = [];
  center_ = null;
  range_ = null;

  textColor; // store the color of text for the graph...

  dataSetSub: Subscription = null;

  constructor(private dataSetService: DataSetService) {
    super();

    this.defaultConfig = {
      displayName: 'Display Label',
      filterSelfPaths: true,
      convertUnitTo: "unitless",
      dataSetUUID: null,
      invertData: false,
      displayMinMax: false,
      includeZero: true,
      minValue: null,
      maxValue: null,
      verticalGraph: false,
      rotaryAxis: false,
    };
   }

  ngOnInit() {
    this.validateConfig();
    this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
    this.chartCtx = this.lineGraph.nativeElement.getContext('2d');

    this.startChart();
    this.subscribeDataSet();
  }

  private startChart() {
    if (this.chart !== null) {
        this.chart.destroy();
    }

    // Setup DataSets
    let ds: IDataSetOptions[] = [
      {
        label: `${this.widgetProperties.config.displayName}-Avg.`,
        data: this.chartDataAvg,
        fill: 'false',
        borderColor: this.textColor,
      }
    ];

    // Min / max display options
    if (this.widgetProperties.config.displayMinMax) {
      ds.push(
        {
          label: `${this.widgetProperties.config.displayName}-Min`,
          data: this.chartDataMin,
          fill: '+1',
          borderColor: this.textColor,
        borderDash: [10, 10]
      },
      {
          label: `${this.widgetProperties.config.displayName}-Max`,
          data: this.chartDataMax,
          fill: '-1',
          borderColor: this.textColor,
        borderDash: [5, 5]
      }
      );
    }

    let xAxis = this.widgetProperties.config.verticalGraph ? 'y' : 'x';
    let yAxis = this.widgetProperties.config.verticalGraph ? 'x' : 'y';

    this.chart = new Chart(this.chartCtx,{
      type: 'line',
      data: {
        datasets: ds
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: this.widgetProperties.config.verticalGraph ? 'y' : 'x',
        parsing: {
          xAxisKey: xAxis,
          yAxisKey: yAxis,
        },
        scales: {
          [yAxis]: {
            position: this.widgetProperties.config.verticalGraph ? 'top' : 'right',
            ...(this.widgetProperties.config.minValue !== null && {suggestedMin: this.widgetProperties.config.minValue}),
            ...(this.widgetProperties.config.maxValue !== null && {suggestedMax: this.widgetProperties.config.maxValue}),
            ...(this.widgetProperties.config.includeZero && { beginAtZero: true}),
            ticks: {
              color: this.textColor,
              callback: this.centeredTickLabel.bind(this),
              autoSkip: true,
              autoSkipPadding: 40
            }
          },
          [xAxis]: {
            position: this.widgetProperties.config.verticalGraph ? 'right': 'bottom',
            type: 'time',
            time: {
                minUnit: 'second',
                round: 'second',
            },
            ticks: {
              color: this.textColor,
              callback: timeDifferenceFromNow,
              autoSkip: true,
              autoSkipPadding: 40
              // maxTicksLimit: 5
            }
          }
        },
        plugins:{
          legend: {
            labels: {
              color: this.textColor,
            }
          }
        }
      }
    });

    function timeDifferenceFromNow(_value, index, values) {
      let tickTime = values[index].value;
      let nowTime = Date.now();
      let timeDiff = Math.floor((nowTime - tickTime) / 1000);
      if (timeDiff < 60) {
        return timeDiff.toString() + " sec ago";
      } else if (timeDiff < 3600) {
        let minDiff = Math.floor(timeDiff / 60);
        let secDiff = timeDiff % 60;
        return (minDiff.toString() + ":" + secDiff.toString().padStart(2, "0") + " min ago");
      } else if (timeDiff < 86400) {
        let hourDiff = Math.floor(timeDiff / 3600);
        return (hourDiff.toString() + " hour ago");
      } else {
        let dayDiff = Math.floor(timeDiff / 86400);
        return (dayDiff.toString() + " day ago");
      }
    }
  }

  private toUser(centered) {
    let v = centered;
    let c = this.center_;
    let r = this.range_;
    let ret = ((0 > v ? v + r : v) + c) % r;
    return Math.round(ret);
  }

  private toCentered(user) {
    // shift so that center value is at 0 in the middle of the scale
    let centered = user - this.center_;
    // deal with parts that are < -180 or > 180 degree
    centered = 
      centered > (this.range_ / 2) ? (centered - this.range_) : 
      centered < -(this.range_ / 2) ? (centered + this.range_) : 
      centered;
    return centered;
  }

  private centeredTickLabel(_value, index, values) {
    if (this.center_ === null || !this.widgetProperties.config.rotaryAxis) {
      return _value;
    }

    const compassRose = {
     0: "N",
     45: "ne",
     90: "E",
     135: "se",
     180: "S",
     225: "sw",
     270: "W",
     315: "nw",
   };
   const lookupDirection = (direction) => compassRose[direction] || direction;

    let ret = lookupDirection(this.toUser(_value));
    
    return ret;
  }


  private reduceData(input, valueField, maxPoints) {
    if (input === null) {
      return null;
    }

    let noNulls = input.filter(function(item) {return item[valueField] !== null;});
    let unique = noNulls.filter(function(item, pos, ary) {return !pos || item.timestamp != ary[pos - 1].timestamp});
    let translated = unique.map(a => ({timestamp: a.timestamp, y: a[valueField]}));

    let clean = [];
    let chunkSize = Math.max(3, Math.floor(translated.length / maxPoints));
    let halfChunk = Math.floor(chunkSize / 2);
    for (let i = halfChunk; i < translated.length - halfChunk; i += chunkSize) {
      let slice = translated.slice(i - halfChunk, i + halfChunk + 1);
      clean.push({timestamp: translated[i].timestamp, y: slice.sort((a, b) => (a.y - b.y))[halfChunk].y});
    }

    let units = this.applyUnits(clean);
    return this.widgetProperties.config.rotaryAxis ? this.centerData(units, 'average' == valueField) : units;
  }

  private applyUnits(input) {
    if (null === input || input.length < 1) {
      return input;
    }

    let invert = this.widgetProperties.config.invertData ? - 1 : 1;    
    let ret = input.map((a) => (
      {timestamp: a.timestamp, 
       y: this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, a.y) * invert}));

    return ret;
  }

  private centerData(input, recenter) {
    if (null === input || input.length < 1) {
      return input;
    }

    //let xAxis = this.config.verticalGraph ? 'y' : 'x';
    let yAxis = this.widgetProperties.config.verticalGraph ? 'x' : 'y';

    if (this.chart.config.options.scales[yAxis].suggestedMax == null ||
        this.chart.config.options.scales[yAxis].suggestedMin == null) {
      this.range_ = null;
      this.center_ = null;
      return input;
    }

    this.range_ = this.chart.config.options.scales[yAxis].suggestedMax - this.chart.config.options.scales[yAxis].suggestedMin;

    this.chart.config.options.scales[yAxis].min = -this.range_ / 2;
    this.chart.config.options.scales[yAxis].max = this.range_ / 2;
    this.chart.config.options.scales[yAxis].ticks.stepSize = this.range_ / 8;

    if (recenter) {
      let c = input[input.length - 1].y;
      let step = (this.range_ / 8);
      this.center_ = Math.ceil(c / step) * step;
    }

    let ret = input.map(a => ({timestamp: a.timestamp, y: this.toCentered(a.y)}));
    return ret;
  }

  private subscribeDataSet() {
      this.unsubscribeDataSet();
      if (this.widgetProperties.config.dataSetUUID === null) { return } // nothing to sub to...

      this.dataSetSub = this.dataSetService.subscribeDataSet(this.widgetProperties.uuid, this.widgetProperties.config.dataSetUUID).subscribe(
          dataSet => {

              let filtered = this.reduceData(dataSet, 'average', 24*2);
              if (filtered === null) {
                return; // we will get null back if we subscribe to a dataSet before the app has started it. When it learns about it we will get first value
              }
              //Avg
              this.chartDataAvg = [];
              for (let i = 0; i < filtered.length; ++i) {
                this.chartDataAvg.push({x: filtered[i].timestamp, y: filtered[i].y});
              }

              this.chart.config.data.datasets[0].data = this.chartDataAvg;

              //min/max
              if (this.widgetProperties.config.displayMinMax) {
                this.chartDataMin = [];
                this.chartDataMax = [];

                let filteredMin = this.reduceData(dataSet, 'minValue', 24 * 2);
                if ( filteredMin !== null) {
                  for (let i=0;i<filteredMin.length;i++){ 
                    //process datapoint and add it to our chart. 
                    this.chartDataMin.push({x: filteredMin[i].timestamp, y: filteredMin[i].y});
                  }
                }

                let filteredMax = this.reduceData(dataSet, 'maxValue', 24 * 2);
                if ( filteredMax !== null) {
                  for (let i=0;i<filteredMax.length;i++){
                    this.chartDataMax.push({x: filteredMax[i].timestamp, y: filteredMax[i].y});
                  }
                }
                this.chart.config.data.datasets[1].data = this.chartDataMin;
                this.chart.config.data.datasets[2].data = this.chartDataMax;
              }

            const average = arr => arr.reduce((p, c) => p + c, 0) / arr.length;
              //if (this.widgetConfig.animateGraph) {
              //  this.chart.update();
              //} else {
                // append the cumulated average to the label text
            this.chart.data.datasets[0].label = this.widgetProperties.config.displayName + " [" + average(this.chartDataAvg.map(e => e.y)).toFixed(2) + "]";
            if (this.widgetProperties.config.displayMinMax) {
              this.chart.data.datasets[1].label = this.widgetProperties.config.displayName + " [" + average(this.chartDataMin.map(e => e.y)).toFixed(2) + "]";
              this.chart.data.datasets[2].label = this.widgetProperties.config.displayName + " [" + average(this.chartDataMax.map(e => e.y)).toFixed(2) + "]";
            }
            this.chart.update('none');
              //}
          }
      );
  }

  private unsubscribeDataSet() {
    if (this.dataSetSub !== null) {
      this.dataSetSub.unsubscribe();
      this.dataSetSub = null;
    }
  }

  ngOnDestroy() {
    this.unsubscribeDataSet();
  }
}

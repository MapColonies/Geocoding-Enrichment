{{/*
Common labels
*/}}
{{- define "geocoding-enrichment.labels" -}}
helm.sh/chart: {{ include "geocoding-enrichment.chart" . }}
{{ include "geocoding-enrichment.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Returns the tag of the chart.
*/}}
{{- define "geocoding-enrichment.tag" -}}
{{- default (printf "v%s" .Chart.AppVersion) .Values.image.tag }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "geocoding-enrichment.selectorLabels" -}}
app.kubernetes.io/name: {{ include "geocoding-enrichment.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Returns the environment from global if exists or from the chart's values, defaults to development
*/}}
{{- define "geocoding-enrichment.environment" -}}
{{- if .Values.global.environment }}
    {{- .Values.global.environment -}}
{{- else -}}
    {{- .Values.environment | default "development" -}}
{{- end -}}
{{- end -}}

{{/*
Returns the tracing url from global if exists or from the chart's values
*/}}
{{- define "geocoding-enrichment.tracingUrl" -}}
{{- if .Values.global.tracing.url }}
    {{- .Values.global.tracing.url -}}
{{- else if .Values.env.tracing.url -}}
    {{- .Values.env.tracing.url -}}
{{- end -}}
{{- end -}}

{{/*
Returns the tracing url from global if exists or from the chart's values
*/}}
{{- define "geocoding-enrichment.metricsUrl" -}}
{{- if .Values.global.metrics.url }}
    {{- .Values.global.metrics.url -}}
{{- else -}}
    {{- .Values.env.metrics.url -}}
{{- end -}}
{{- end -}}

{{/*
Return the proper image name
*/}}
{{- define "geocoding-enrichment.image" -}}
{{ include "common.images.image" (dict "imageRoot" .Values.image "global" .Values.global) }}
{{- end -}}


{{/*
Return the proper Docker Image Registry Secret Names
*/}}
{{- define "geocoding-enrichment.imagePullSecrets" -}}
{{ include "common.images.renderPullSecrets" (dict "images" (list .Values.image) "context" $) }}
{{- end -}}

{{/*
Return the proper image pullPolicy
*/}}
{{- define "geocoding-enrichment.pullPolicy" -}}
{{ include "common.images.pullPolicy" (dict "imageRoot" .Values.image "global" .Values.global) }}
{{- end -}}

{{/*
Return the proper image deploymentFlavor
*/}}
{{- define "geocoding-enrichment.deploymentFlavor" -}}
{{ include "common.images.deploymentFlavor" (dict "imageRoot" .Values.image "global" .Values.global) }}
{{- end -}}


{{/*
Return the proper fully qualified app name
*/}}
{{- define "geocoding-enrichment.fullname" -}}
{{ include "common.names.fullname" . }}
{{- end -}}

{{/*
Return the proper chart name
*/}}
{{- define "geocoding-enrichment.name" -}}
{{ include "common.names.name" . }}
{{- end -}}

{{/*
Return the proper chart name
*/}}
{{- define "geocoding-enrichment.chart" -}}
{{ include "common.names.chart" . }}
{{- end -}}

# use these to run the update locally (on the beta stack)
outputs=$(sam list stack-outputs --output json)
function get_output() {
  echo "$outputs" | jq -r '.[] | select(.OutputKey=="'"$1"'") | .OutputValue'
}
export GITHUB_REPO=$(get_output "GithubRepo")
export GITHUB_SECRET=$(get_output "GithubSecret")
export JSDELIVR_PATH=$(get_output "JsdelivrPath")
export CURRENCY_FILE=$(get_output "CurrencyFile")
export GITHUB_NAME=$(get_output "CommitterName")
export GITHUB_EMAIL=$(get_output "CommitterEmail")
export BUCKET=$(get_output "Bucket")
export CDN_URL=$(get_output "CdnUrl")
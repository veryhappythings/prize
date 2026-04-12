# Prize

Prize is an AI augmented pull request review tool.

As usage of AI agents grows, I'm receiving more pull requests, and those pull requests are getting
larger. Prize reads the PR and uses LLMs to contextualise the changes, presenting them in a way
that makes it easier to understand the changes and their implications.

The narrative of a pull request is important. Some people I've worked with are masters at telling
stories with their diffs, explaining the change commit by commit in a way that helps the reviwer
understand the change. AI agents generally do not do this. We can help them.

## Usage

From source

```
yarn install
yarn build
GITHUB_TOKEN=<token from github> ./dist/cli.js https://github.com/kubernetes/kubernetes/pull/138214
```

You can configure your LLM provider with environment variables:

```
LLM_PROVIDER = 'anthropic' | 'openai' | 'bedrock'
LLM_API_KEY or ANTHROPIC_API_KEY
LLM_BASE_URL
LLM_MODEL
AWS_REGION (if using Bedrock)
```

## Limitations

- Currently only supports GitHub
- Supports OpenAI compatible APIs, Anthropic, and AWS Bedrock

## How it works

Prize uses the GitHub API to fetch the pull request data, including the changed files and their
contents. It then uses an LLM to build an overview of the changes, followed by a structure that
breaks up the change into narratively coherent sections. Finally, the LLM is called for each
section to contextualise it in place. The result is a primer on the change that flows, rather than
an alphabetically ordered list of files that makes no sense.

The results of the API calls and LLM calls are cached in `~/.prize`. If you run Prize on the same
PR it will only recalculate the pages if the PR has changed.
